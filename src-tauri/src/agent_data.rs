// Read-only access to the agent's filesystem state.
// This module never writes to Agent/Scripts/ or competitor folders — strict read-only.

use crate::settings::{project_folder_opt, SettingsState};
use regex::Regex;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::State;

// ── Type mirrors for the TS layer ───────────────────────────────────────────

#[derive(Serialize, Debug, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrackingCounts {
    pub confirmed: u32,
    pub blocked: u32,
    pub needs_review: u32,
    pub already_on_nowgg: u32,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Competitor {
    pub name: String,
    pub folder: String,
    pub slug: String,
    pub has_similarweb_file: bool,
    pub similarweb_file_name: Option<String>,
    pub similarweb_age_days: Option<i64>,
    pub has_gap_analysis: bool,
    pub gap_analysis_age_days: Option<i64>,
    pub gap_size: Option<u32>,
    pub counts: TrackingCounts,
    pub remaining: Option<i32>,
    pub is_exhausted: bool,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RunLogRow {
    pub date: String,
    pub competitor: String,
    pub investigated: u32,
    pub found: u32,
    pub blocked: u32,
    pub email_status: String,
    pub raw: String,
}

#[derive(Serialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct LastRunSummary {
    pub date: Option<String>,
    pub time: Option<String>,
    pub competitor: Option<String>,
    pub investigated: Option<u32>,
    pub found: Option<u32>,
    pub blocked: Option<u32>,
    pub next_game: Option<String>,
    pub total_confirmed: Option<u32>,
    pub total_blocked: Option<u32>,
    pub remaining: Option<u32>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EnvStatus {
    pub scripts_dir: String,
    pub agent_root: String,
    pub token_file_exists: bool,
    pub token_age_days: Option<i64>,
    pub env_file_exists: bool,
    pub has_github_token: bool,
    pub has_tavily_key: bool,
    pub has_sheets_id: bool,
    pub nowgg_games_csv_exists: bool,
    pub nowgg_games_csv_age_days: Option<i64>,
    pub launchd_daily_exists: bool,
    pub launchd_weekly_exists: bool,
}

// ── Path resolution ─────────────────────────────────────────────────────────
// All paths are now derived from the user-configured project folder
// (settings.json). Each command accepts a `SettingsState` and resolves at call
// time so a path change in Settings is picked up without restart.

fn project_root(state: &SettingsState) -> Option<PathBuf> {
    project_folder_opt(state)
}

fn agent_root(state: &SettingsState) -> Option<PathBuf> {
    project_root(state).map(|p| p.join("Agent"))
}

fn scripts_dir(state: &SettingsState) -> Option<PathBuf> {
    agent_root(state).map(|p| p.join("Scripts"))
}

fn home_dir() -> PathBuf {
    // Cross-platform home dir. HOME on Unix, USERPROFILE on Windows.
    if let Ok(h) = std::env::var("HOME") {
        return PathBuf::from(h);
    }
    if let Ok(h) = std::env::var("USERPROFILE") {
        return PathBuf::from(h);
    }
    PathBuf::from(".")
}

// ── Helpers ────────────────────────────────────────────────────────────────

fn file_age_days(path: &Path) -> Option<i64> {
    let meta = fs::metadata(path).ok()?;
    let mtime = meta.modified().ok()?;
    let now = SystemTime::now();
    let dur = now.duration_since(mtime).ok()?;
    Some((dur.as_secs() / 86400) as i64)
}

fn slugify(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect()
}

// ── Tracking list parsing ──────────────────────────────────────────────────

pub fn parse_tracking_counts(tracking_path: &Path) -> TrackingCounts {
    let content = match fs::read_to_string(tracking_path) {
        Ok(s) => s,
        Err(_) => return TrackingCounts::default(),
    };
    let mut counts = TrackingCounts::default();
    for line in content.lines() {
        let trimmed = line.trim_start();
        if !trimmed.starts_with('|') {
            continue;
        }
        let parts: Vec<&str> = line.split('|').map(|p| p.trim()).collect();
        if parts.len() < 8 {
            continue;
        }
        // parts[0] is empty (leading |), parts[5] is the status column per agent's convention
        let status = parts.get(6).copied().unwrap_or("");
        // Match the agent's symbol convention (parts[5] in its parser = parts[6] in ours due to leading empty)
        // Actually: line "| 1 | Game | 100 | url | ✅ | notes |" splits to ["","1","Game","100","url","✅","notes",""]
        // so parts[5] = "✅". Let me check both indices to be robust.
        let status_alt = parts.get(5).copied().unwrap_or("");
        let s = if status.contains('✅') || status.contains('❌') || status.contains('⚠') || status.contains('🔄') {
            status
        } else {
            status_alt
        };
        if s.contains("✅") {
            counts.confirmed += 1;
        } else if s.contains("❌") {
            counts.blocked += 1;
        } else if s.contains("⚠") {
            counts.needs_review += 1;
        } else if s.contains("🔄") {
            counts.already_on_nowgg += 1;
        }
    }
    counts
}

// ── Competitor folder enumeration ──────────────────────────────────────────

#[tauri::command]
pub fn list_competitors(state: State<SettingsState>) -> Result<Vec<Competitor>, String> {
    // In viewer mode (no project folder configured), return an empty list
    // instead of an error so the Competitors tab can show a "viewer mode —
    // data comes from snapshot" hint instead of a stack trace.
    let Some(root) = project_root(&state) else {
        return Ok(Vec::new());
    };
    let mut result = Vec::new();

    let entries = fs::read_dir(&root).map_err(|e| format!("read project root: {}", e))?;
    let mut folders: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.is_dir()
                && p.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.ends_with(" vs Now.gg"))
                    .unwrap_or(false)
        })
        .collect();
    folders.sort();

    for folder in folders {
        let folder_name = folder
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let name = folder_name.replace(" vs Now.gg", "");
        let slug = slugify(&name);

        // SimilarWeb file: any .xlsx in the folder root
        let mut sw_file: Option<(String, i64)> = None;
        if let Ok(entries) = fs::read_dir(&folder) {
            for entry in entries.filter_map(|e| e.ok()) {
                let p = entry.path();
                if p.extension().and_then(|s| s.to_str()) == Some("xlsx") {
                    let fname = p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                    let age = file_age_days(&p).unwrap_or(0);
                    sw_file = Some((fname, age));
                    break;
                }
            }
        }

        // Gap analysis: latest CSV in Gap Analysis/ subfolder
        let gap_folder = folder.join("Gap Analysis");
        let mut latest_gap: Option<(PathBuf, i64, u32)> = None;
        if gap_folder.exists() {
            if let Ok(entries) = fs::read_dir(&gap_folder) {
                let mut csvs: Vec<(PathBuf, SystemTime)> = entries
                    .filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .filter(|p| {
                        p.extension().and_then(|s| s.to_str()) == Some("csv")
                            && p.file_name()
                                .and_then(|n| n.to_str())
                                .map(|n| n.starts_with("gap-analysis-"))
                                .unwrap_or(false)
                    })
                    .filter_map(|p| {
                        let mtime = fs::metadata(&p).ok()?.modified().ok()?;
                        Some((p, mtime))
                    })
                    .collect();
                csvs.sort_by(|a, b| b.1.cmp(&a.1));
                if let Some((p, _)) = csvs.first() {
                    let age = file_age_days(p).unwrap_or(0);
                    // Count rows (excluding header) — cheap line count
                    let row_count = fs::read_to_string(p)
                        .map(|s| s.lines().count().saturating_sub(1) as u32)
                        .unwrap_or(0);
                    latest_gap = Some((p.clone(), age, row_count));
                }
            }
        }

        // Tracking counts
        let tracking_path = folder.join("game-tracking-list.md");
        let counts = parse_tracking_counts(&tracking_path);

        let investigated = counts.confirmed + counts.blocked + counts.needs_review;
        let (gap_size, remaining, is_exhausted) = match &latest_gap {
            Some((_, _, n)) => {
                let n = *n;
                let rem = (n as i32) - (investigated as i32);
                let rem = rem.max(0);
                (Some(n), Some(rem), rem == 0 && n > 0)
            }
            None => (None, None, false),
        };

        result.push(Competitor {
            name,
            folder: folder.to_string_lossy().to_string(),
            slug,
            has_similarweb_file: sw_file.is_some(),
            similarweb_file_name: sw_file.as_ref().map(|(n, _)| n.clone()),
            similarweb_age_days: sw_file.as_ref().map(|(_, a)| *a),
            has_gap_analysis: latest_gap.is_some(),
            gap_analysis_age_days: latest_gap.as_ref().map(|(_, a, _)| *a),
            gap_size,
            counts,
            remaining,
            is_exhausted,
        });
    }

    Ok(result)
}

// ── CLAUDE.md parsing ──────────────────────────────────────────────────────

#[tauri::command]
pub fn read_run_log(state: State<SettingsState>) -> Result<Vec<RunLogRow>, String> {
    // Viewer mode (no project folder): return empty list so History tab can
    // render its "fetch from snapshot" UI instead of bombing out.
    let Some(agent) = agent_root(&state) else {
        return Ok(Vec::new());
    };
    let path = agent.join("CLAUDE.md");
    let content = fs::read_to_string(&path).map_err(|e| format!("read CLAUDE.md: {}", e))?;

    let mut rows = Vec::new();
    let mut in_log = false;
    let date_re = Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap();

    for line in content.lines() {
        if line.starts_with("## Agent Run Log") {
            in_log = true;
            continue;
        }
        if in_log && line.starts_with("## ") {
            break;
        }
        if !in_log || !line.starts_with('|') {
            continue;
        }
        let cells: Vec<String> = line
            .split('|')
            .map(|s| s.trim().to_string())
            .collect();
        if cells.len() < 8 {
            continue;
        }
        // | "" | Date | Competitor | Investigated | Found | Blocked | Email | ""
        let date = &cells[1];
        if !date_re.is_match(date) {
            continue;
        }
        let parse_int = |s: &str| -> u32 {
            Regex::new(r"\d+")
                .unwrap()
                .find(s)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(0)
        };
        rows.push(RunLogRow {
            date: date.clone(),
            competitor: cells[2].clone(),
            investigated: parse_int(&cells[3]),
            found: parse_int(&cells[4]),
            blocked: parse_int(&cells[5]),
            email_status: cells[6].clone(),
            raw: line.to_string(),
        });
    }

    // Newest first
    rows.sort_by(|a, b| b.date.cmp(&a.date));
    Ok(rows)
}

#[tauri::command]
pub fn read_last_run_summary(state: State<SettingsState>) -> Result<LastRunSummary, String> {
    let Some(agent) = agent_root(&state) else {
        return Ok(LastRunSummary::default());
    };
    let path = agent.join("CLAUDE.md");
    let content = fs::read_to_string(&path).map_err(|e| format!("read CLAUDE.md: {}", e))?;

    let mut summary = LastRunSummary::default();
    let mut in_section = false;

    let extract = |line: &str, key: &str| -> Option<String> {
        let needle = format!("**{}:**", key);
        line.find(&needle)
            .map(|idx| line[idx + needle.len()..].trim().to_string())
    };
    let parse_uint = |s: &str| -> Option<u32> {
        Regex::new(r"\d+")
            .unwrap()
            .find(s)
            .and_then(|m| m.as_str().parse().ok())
    };

    for line in content.lines() {
        if line.starts_with("## Last Run Summary") {
            in_section = true;
            continue;
        }
        if in_section && line.starts_with("---") {
            break;
        }
        if in_section && line.starts_with("## ") {
            break;
        }
        if !in_section {
            continue;
        }
        if let Some(v) = extract(line, "Last run") {
            // "2026-05-22 at 08:47 IST" → date + time
            let parts: Vec<&str> = v.split(" at ").collect();
            if let Some(d) = parts.first() {
                summary.date = Some(d.trim().to_string());
            }
            if let Some(t) = parts.get(1) {
                summary.time = Some(t.trim().trim_end_matches(" IST").to_string());
            }
        } else if let Some(v) = extract(line, "Competitor") {
            summary.competitor = Some(v);
        } else if let Some(v) = extract(line, "Investigated today") {
            summary.investigated = parse_uint(&v);
        } else if let Some(v) = extract(line, "Found today") {
            summary.found = parse_uint(&v);
        } else if let Some(v) = extract(line, "Blocked today") {
            summary.blocked = parse_uint(&v);
        } else if let Some(v) = extract(line, "Next game") {
            summary.next_game = Some(v);
        } else if let Some(v) = extract(line, "Total ✅ so far") {
            summary.total_confirmed = parse_uint(&v);
        } else if let Some(v) = extract(line, "Total ❌ so far") {
            summary.total_blocked = parse_uint(&v);
        } else if let Some(v) = extract(line, "Remaining in list") {
            summary.remaining = parse_uint(&v);
        }
    }

    Ok(summary)
}

// ── Environment / config status ────────────────────────────────────────────

#[tauri::command]
pub fn read_env_status(state: State<SettingsState>) -> Result<EnvStatus, String> {
    let (scripts, agent, root) = match (scripts_dir(&state), agent_root(&state), project_root(&state)) {
        (Some(s), Some(a), Some(r)) => (s, a, r),
        _ => {
            // Viewer mode — return an empty/default EnvStatus so Settings tab
            // can render "no local agent" hint instead of crashing.
            return Ok(EnvStatus {
                scripts_dir: String::new(),
                agent_root: String::new(),
                token_file_exists: false,
                token_age_days: None,
                env_file_exists: false,
                has_github_token: false,
                has_tavily_key: false,
                has_sheets_id: false,
                nowgg_games_csv_exists: false,
                nowgg_games_csv_age_days: None,
                launchd_daily_exists: false,
                launchd_weekly_exists: false,
            });
        }
    };

    let token_file = scripts.join("token.json");
    let env_file = scripts.join(".env");
    let nowgg_csv = root.join("nowgg-existing-games.csv");

    let mut has_github = false;
    let mut has_tavily = false;
    let mut has_sheets_id = false;
    if let Ok(env_content) = fs::read_to_string(&env_file) {
        for line in env_content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('#') || trimmed.is_empty() {
                continue;
            }
            if let Some((k, v)) = trimmed.split_once('=') {
                let k = k.trim();
                let has_value = !v
                    .trim()
                    .trim_matches('"')
                    .trim_matches('\'')
                    .is_empty();
                if !has_value {
                    continue;
                }
                match k {
                    "GITHUB_TOKEN" => has_github = true,
                    "TAVILY_API_KEY" => has_tavily = true,
                    "SHEETS_ID" => has_sheets_id = true,
                    _ => {}
                }
            }
        }
    }

    let launchd_daily = home_dir()
        .join("Library/LaunchAgents/com.nowgg.competitor-agent.plist");
    let launchd_weekly = home_dir()
        .join("Library/LaunchAgents/com.nowgg.competitor-agent-weekly.plist");

    Ok(EnvStatus {
        scripts_dir: scripts.to_string_lossy().to_string(),
        agent_root: agent.to_string_lossy().to_string(),
        token_file_exists: token_file.exists(),
        token_age_days: file_age_days(&token_file),
        env_file_exists: env_file.exists(),
        has_github_token: has_github,
        has_tavily_key: has_tavily,
        has_sheets_id: has_sheets_id,
        nowgg_games_csv_exists: nowgg_csv.exists(),
        nowgg_games_csv_age_days: file_age_days(&nowgg_csv),
        launchd_daily_exists: launchd_daily.exists(),
        launchd_weekly_exists: launchd_weekly.exists(),
    })
}

// ── Open path in Finder / default app ──────────────────────────────────────

#[tauri::command]
pub fn open_path(state: State<SettingsState>, path: String) -> Result<(), String> {
    // Safety: only allow opening paths within the configured project root.
    let target = PathBuf::from(&path);
    let canonical = target.canonicalize().map_err(|e| format!("canonicalize: {}", e))?;
    let Some(allowed) = project_root(&state) else {
        return Err("Project folder not configured — cannot open paths in viewer mode.".to_string());
    };
    let allowed_canonical = allowed
        .canonicalize()
        .map_err(|e| format!("canonicalize allowed: {}", e))?;
    if !canonical.starts_with(&allowed_canonical) {
        return Err(format!("refusing to open path outside project root: {}", path));
    }
    std::process::Command::new("open")
        .arg(canonical.as_os_str())
        .spawn()
        .map_err(|e| format!("open: {}", e))?;
    Ok(())
}

