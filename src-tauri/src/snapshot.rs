// Snapshot fetcher — pulls compintel-state.json from a URL configured in
// Settings. Used by viewer mode so the UI can render Dashboard / Competitors /
// History without any local Python or project folder.
//
// Cached on disk in Tauri's app config dir so the viewer still shows last-known
// state when offline (e.g., commute, conference WiFi).

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

const CACHE_FILENAME: &str = "compintel-state-cache.json";

/// Shape of the snapshot — mirrors what the Python agent's Part 9 writes.
/// Kept loose (serde_json::Value) for the bulky payload arrays so we can
/// evolve the schema without breaking older installs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub version: u32,
    #[serde(rename = "generatedAt")]
    pub generated_at: String,
    #[serde(rename = "agentVersion", default)]
    pub agent_version: String,
    pub summary: serde_json::Value,
    pub competitors: serde_json::Value,
    #[serde(rename = "runLog", default)]
    pub run_log: serde_json::Value,
    #[serde(default)]
    pub sheets: serde_json::Value,
}

fn cache_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("could not resolve app config dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("could not create config dir: {e}"))?;
    Ok(dir.join(CACHE_FILENAME))
}

fn write_cache(app: &tauri::AppHandle, body: &str) -> Result<(), String> {
    let path = cache_path(app)?;
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, body).map_err(|e| format!("cache write failed: {e}"))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("cache rename failed: {e}"))?;
    Ok(())
}

/// Fetch the snapshot from `url` synchronously via the Rust ureq client.
/// Returns the parsed snapshot; writes the raw body to cache for offline reuse.
/// 10-second timeout — viewer mode is interactive, slow responses block UI.
#[tauri::command]
pub fn fetch_snapshot(app: tauri::AppHandle, url: String) -> Result<Snapshot, String> {
    if url.trim().is_empty() {
        return Err(
            "Snapshot URL is not set. Open Settings → paste the snapshot URL provided by your admin."
                .to_string(),
        );
    }
    // Defensive: only http(s) — refuse file:// or other schemes for the viewer's
    // network fetcher.
    let url_lower = url.to_lowercase();
    if !(url_lower.starts_with("http://") || url_lower.starts_with("https://")) {
        return Err("Snapshot URL must start with http:// or https://".to_string());
    }
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(10))
        .build();
    let resp = agent
        .get(&url)
        .call()
        .map_err(|e| format!("fetch failed: {e}"))?;
    let body = resp
        .into_string()
        .map_err(|e| format!("read body failed: {e}"))?;
    let parsed: Snapshot = serde_json::from_str(&body)
        .map_err(|e| format!("snapshot is not valid JSON: {e}"))?;
    // Cache successful fetch for offline.
    let _ = write_cache(&app, &body);
    Ok(parsed)
}

/// Return the last cached snapshot (offline fallback) or None.
#[tauri::command]
pub fn get_cached_snapshot(app: tauri::AppHandle) -> Option<Snapshot> {
    let path = cache_path(&app).ok()?;
    let text = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&text).ok()
}
