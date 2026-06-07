// Subprocess spawning + stdout streaming for the Python agent.
//
// Contract: this module spawns `python3 run_agent.py [--competitor "..."]` from
// the agent's Scripts/ directory. It NEVER edits any agent source file. The
// subprocess command is byte-for-byte the same one launchd uses.

use crate::settings::{require_project_folder, SettingsState};
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::SystemTime;
use tauri::{AppHandle, Emitter, Runtime, State};

// ── Path resolution ──────────────────────────────────────────────────────────
// Resolved at call time from SettingsState — no hardcoded developer paths.

fn scripts_dir_from_settings(state: &SettingsState) -> Result<std::path::PathBuf, String> {
    let root = require_project_folder(state)?;
    Ok(root.join("Agent").join("Scripts"))
}

// ── Active-run tracking (one at a time for V1) ───────────────────────────────

static RUN_COUNTER: AtomicU64 = AtomicU64::new(0);

// Only the Child handle lives in the mutex — the run_id stays with the threads
// that need it. Keeps the lock surface minimal.
static ACTIVE_CHILD: Mutex<Option<Child>> = Mutex::new(None);

// ── Event payloads ──────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct StdoutEvent {
    run_id: String,
    stream: &'static str, // "stdout" | "stderr"
    line: String,
    ts_ms: u128,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DoneEvent {
    run_id: String,
    exit_code: Option<i32>,
    duration_ms: u128,
}

// ── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn start_agent<R: Runtime>(
    app: AppHandle<R>,
    state: State<SettingsState>,
    competitor: Option<String>,
) -> Result<String, String> {
    // Reject if another run is already in flight.
    {
        let guard = ACTIVE_CHILD.lock().map_err(|e| format!("lock: {}", e))?;
        if guard.is_some() {
            return Err("Another agent run is already in progress.".into());
        }
    }

    // Sanitize competitor — mirror the Python-side check exactly.
    if let Some(c) = &competitor {
        let valid = c
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, ' ' | '.' | '_' | '-'));
        if c.is_empty() || c.len() > 40 || !valid {
            return Err(format!(
                "--competitor must be 1–40 chars of letters/digits/space/._- only. Got: {:?}",
                c
            ));
        }
    }

    let scripts = scripts_dir_from_settings(&state)?;
    let runner = scripts.join("run_agent.py");
    if !runner.exists() {
        return Err(format!("run_agent.py not found at {:?}", runner));
    }

    let run_id = format!(
        "run-{}-{}",
        now_ms() / 1000,
        RUN_COUNTER.fetch_add(1, Ordering::SeqCst),
    );

    // Build the same command launchd uses.
    let mut cmd = Command::new("python3");
    cmd.arg(&runner);
    cmd.current_dir(&scripts);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    cmd.env("PYTHONUNBUFFERED", "1"); // line-by-line streaming

    if let Some(c) = &competitor {
        cmd.arg("--competitor").arg(c);
    }

    let mut child = cmd.spawn().map_err(|e| format!("spawn python3: {}", e))?;
    let stdout = child.stdout.take().ok_or("capture stdout")?;
    let stderr = child.stderr.take().ok_or("capture stderr")?;

    // stdout streamer
    {
        let app = app.clone();
        let run_id = run_id.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                let _ = app.emit(
                    "agent:stdout",
                    StdoutEvent {
                        run_id: run_id.clone(),
                        stream: "stdout",
                        line,
                        ts_ms: now_ms(),
                    },
                );
            }
        });
    }

    // stderr streamer
    {
        let app = app.clone();
        let run_id = run_id.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                let _ = app.emit(
                    "agent:stdout",
                    StdoutEvent {
                        run_id: run_id.clone(),
                        stream: "stderr",
                        line,
                        ts_ms: now_ms(),
                    },
                );
            }
        });
    }

    // Park the child handle so stop_agent can reach it.
    {
        let mut guard = ACTIVE_CHILD.lock().map_err(|e| format!("lock: {}", e))?;
        *guard = Some(child);
    }

    // Reaper thread — claims the child, waits, emits done, clears slot.
    {
        let app = app.clone();
        let run_id_done = run_id.clone();
        let start = SystemTime::now();
        thread::spawn(move || {
            // Take the child out of the lock so wait() runs without holding it.
            let child_opt = ACTIVE_CHILD.lock().ok().and_then(|mut g| g.take());

            let exit_code = if let Some(mut c) = child_opt {
                c.wait().ok().and_then(|s| s.code())
            } else {
                None
            };

            let duration = SystemTime::now()
                .duration_since(start)
                .map(|d| d.as_millis())
                .unwrap_or(0);

            let _ = app.emit(
                "agent:done",
                DoneEvent {
                    run_id: run_id_done,
                    exit_code,
                    duration_ms: duration,
                },
            );
        });
    }

    Ok(run_id)
}

#[tauri::command]
pub fn stop_agent() -> Result<(), String> {
    let mut guard = ACTIVE_CHILD.lock().map_err(|e| format!("lock: {}", e))?;
    if let Some(child) = guard.as_mut() {
        child.kill().map_err(|e| format!("kill: {}", e))?;
        Ok(())
    } else {
        Err("no active run".into())
    }
}

#[tauri::command]
pub fn is_agent_running() -> bool {
    ACTIVE_CHILD.lock().map(|g| g.is_some()).unwrap_or(false)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}
