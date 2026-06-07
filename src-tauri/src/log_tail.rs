// Live log tailing via simple polling (no notify crate, no extra deps).
// One tail can run per logical channel ("daily" / "weekly"). The tailer thread
// reads the file size every 800ms; if it grew, reads the delta and emits new
// lines via `log:line` Tauri events. Truncation (file rotation) resets to 0.

use serde::Serialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};

const POLL_INTERVAL_MS: u64 = 800;

fn log_path(which: &str) -> Option<&'static str> {
    match which {
        "daily" => Some("/tmp/nowgg-agent.log"),
        "weekly" => Some("/tmp/nowgg-weekly-digest.log"),
        _ => None,
    }
}

// Active tailers — map from channel name → stop flag.
// When a stop flag is flipped to true, the polling thread exits at its next tick.
static ACTIVE: Mutex<Option<HashMap<String, Arc<AtomicBool>>>> = Mutex::new(None);

fn registry() -> std::sync::MutexGuard<'static, Option<HashMap<String, Arc<AtomicBool>>>> {
    let mut guard = ACTIVE.lock().expect("registry lock");
    if guard.is_none() {
        *guard = Some(HashMap::new());
    }
    guard
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LogLineEvent {
    channel: String,
    line: String,
}

#[tauri::command]
pub fn start_log_tail<R: Runtime>(app: AppHandle<R>, channel: String) -> Result<(), String> {
    let path = log_path(&channel)
        .ok_or_else(|| format!("unknown channel: {} (use 'daily' or 'weekly')", channel))?
        .to_string();

    // If a tail for this channel is already running, do nothing.
    {
        let reg = registry();
        if let Some(map) = reg.as_ref() {
            if map.contains_key(&channel) {
                return Ok(());
            }
        }
    }

    let stop = Arc::new(AtomicBool::new(false));
    {
        let mut reg = registry();
        if let Some(map) = reg.as_mut() {
            map.insert(channel.clone(), stop.clone());
        }
    }

    let app = app.clone();
    let ch = channel.clone();

    thread::spawn(move || {
        // Send the existing content first so the UI starts with the tail-end.
        let mut last_pos: u64 = 0;
        match File::open(&path) {
            Ok(mut f) => {
                // For an existing log, start from the last ~50 KB so we don't
                // dump huge history into the UI on startup.
                let len = f.seek(SeekFrom::End(0)).unwrap_or(0);
                let start = if len > 50_000 { len - 50_000 } else { 0 };
                let _ = f.seek(SeekFrom::Start(start));
                let reader = BufReader::new(&mut f);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = app.emit(
                        "log:line",
                        LogLineEvent { channel: ch.clone(), line },
                    );
                }
                last_pos = len;
            }
            Err(_) => {
                let _ = app.emit(
                    "log:line",
                    LogLineEvent {
                        channel: ch.clone(),
                        line: format!("[file does not exist yet: {}]", path),
                    },
                );
            }
        }

        // Poll loop.
        loop {
            if stop.load(Ordering::Relaxed) {
                break;
            }
            thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));

            let mut f = match File::open(&path) {
                Ok(f) => f,
                Err(_) => continue,
            };
            let current_len = match f.seek(SeekFrom::End(0)) {
                Ok(n) => n,
                Err(_) => continue,
            };

            // File rotated / truncated — reset and start over from byte 0.
            if current_len < last_pos {
                last_pos = 0;
            }
            if current_len > last_pos {
                let _ = f.seek(SeekFrom::Start(last_pos));
                let reader = BufReader::new(&mut f);
                for line in reader.lines().map_while(Result::ok) {
                    if stop.load(Ordering::Relaxed) {
                        break;
                    }
                    let _ = app.emit(
                        "log:line",
                        LogLineEvent { channel: ch.clone(), line },
                    );
                }
                last_pos = current_len;
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_log_tail(channel: String) -> Result<(), String> {
    let mut reg = registry();
    if let Some(map) = reg.as_mut() {
        if let Some(stop) = map.remove(&channel) {
            stop.store(true, Ordering::Relaxed);
        }
    }
    Ok(())
}
