// Persisted Compintel settings (mode, project folder path, snapshot URL).
//
// Stored as JSON in Tauri's app data directory so settings survive across
// launches and per-user installs. Replaces the hardcoded `/Users/bluestacks`
// paths that made the V1 binary non-portable.
//
// macOS:   ~/Library/Application Support/com.nowgg.compintel/settings.json
// Windows: %APPDATA%\com.nowgg.compintel\settings.json
// Linux:   ~/.config/com.nowgg.compintel/settings.json

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State};

pub const DEFAULT_MODE: &str = "viewer";
pub const SETTINGS_FILENAME: &str = "compintel-settings.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub mode: String,                   // "viewer" | "operator"
    #[serde(rename = "projectFolder", default)]
    pub project_folder: Option<String>, // absolute path to "Compitior Analysis/"
    #[serde(rename = "snapshotUrl", default)]
    pub snapshot_url: String,           // URL to compintel-state.json
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            mode: DEFAULT_MODE.to_string(),
            project_folder: None,
            snapshot_url: String::new(),
        }
    }
}

/// Mutex-wrapped settings — Tauri's `State<>` requires Send + Sync.
pub struct SettingsState(pub Mutex<AppSettings>);

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("could not resolve app config dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("could not create config dir: {e}"))?;
    Ok(dir.join(SETTINGS_FILENAME))
}

/// Read settings from disk; on any error (missing, malformed) return defaults.
/// Never panics — first launch always works.
pub fn read_from_disk(app: &tauri::AppHandle) -> AppSettings {
    let Ok(path) = settings_path(app) else {
        return AppSettings::default();
    };
    let Ok(text) = std::fs::read_to_string(&path) else {
        return AppSettings::default();
    };
    serde_json::from_str(&text).unwrap_or_default()
}

/// Atomic write — tmp + rename so a kill mid-write doesn't corrupt the file.
fn write_to_disk(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    let tmp = path.with_extension("tmp");
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("serialize failed: {e}"))?;
    std::fs::write(&tmp, json).map_err(|e| format!("write tmp failed: {e}"))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("rename failed: {e}"))?;
    Ok(())
}

/// Return the project folder for operator-mode commands.
/// Order of resolution:
///   1. Persisted setting (user-configured via Settings tab or first-launch picker)
///   2. Dev fallback (the original hardcoded path) — only when CARGO_MANIFEST_DIR is
///      under /Users/bluestacks; safe no-op for distributed builds.
///   3. Error — caller surfaces "configure project folder in Settings".
pub fn require_project_folder(state: &SettingsState) -> Result<PathBuf, String> {
    let guard = state.0.lock().map_err(|_| "settings lock poisoned".to_string())?;
    if let Some(p) = &guard.project_folder {
        if !p.is_empty() {
            return Ok(PathBuf::from(p));
        }
    }
    // Dev convenience: if the original path still exists, use it.
    let dev_path = PathBuf::from(
        "/Users/bluestacks/Desktop/Now.gg/now.gg_work/Compitior Analysis",
    );
    if dev_path.exists() {
        return Ok(dev_path);
    }
    Err(
        "Project folder not configured. Switch to Operator mode in Settings and select your local 'Compitior Analysis' folder."
            .to_string(),
    )
}

/// Same as `require_project_folder` but returns Option — for read-only callers
/// that should degrade gracefully (e.g., Dashboard rendering "no data" instead
/// of an error toast) in viewer mode.
pub fn project_folder_opt(state: &SettingsState) -> Option<PathBuf> {
    require_project_folder(state).ok()
}

// ── Tauri commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn load_settings(
    app: tauri::AppHandle,
    state: State<SettingsState>,
) -> Result<AppSettings, String> {
    let loaded = read_from_disk(&app);
    let mut guard = state.0.lock().map_err(|_| "settings lock poisoned".to_string())?;
    *guard = loaded.clone();
    Ok(loaded)
}

#[tauri::command]
pub fn save_settings(
    app: tauri::AppHandle,
    state: State<SettingsState>,
    mode: String,
    project_folder: Option<String>,
    snapshot_url: String,
) -> Result<(), String> {
    let settings = AppSettings {
        mode,
        project_folder,
        snapshot_url,
    };
    write_to_disk(&app, &settings)?;
    let mut guard = state.0.lock().map_err(|_| "settings lock poisoned".to_string())?;
    *guard = settings;
    Ok(())
}

#[tauri::command]
pub fn get_default_project_folder() -> Option<String> {
    // Surface the dev-environment default to the UI so the first-launch picker
    // can pre-fill it if applicable. Returns None on machines where the
    // original path doesn't exist (i.e., every machine except the developer's).
    let dev_path = PathBuf::from(
        "/Users/bluestacks/Desktop/Now.gg/now.gg_work/Compitior Analysis",
    );
    if dev_path.exists() {
        Some(dev_path.to_string_lossy().to_string())
    } else {
        None
    }
}
