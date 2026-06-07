mod agent_data;
mod file_ops;
mod log_tail;
mod run_agent;
mod settings;
mod snapshot;

use agent_data::{
    list_competitors, open_path, read_env_status, read_last_run_summary, read_run_log,
};
use file_ops::{add_competitor, upload_similarweb_file};
use log_tail::{start_log_tail, stop_log_tail};
use run_agent::{is_agent_running, start_agent, stop_agent};
use settings::{
    get_default_project_folder, load_settings, save_settings, AppSettings, SettingsState,
};
use snapshot::{fetch_snapshot, get_cached_snapshot};
use std::sync::Mutex;
use tauri::menu::{AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // Settings state — read once from disk at setup so commands don't
        // each pay the I/O cost.
        .manage(SettingsState(Mutex::new(AppSettings::default())))
        .setup(|app| {
            // Eagerly load persisted settings (mode, project folder, snapshot URL).
            // The frontend's settingsStore.load() will also re-fetch this, but
            // priming the Mutex here means require_project_folder() works for
            // any command invoked before the JS has booted.
            let handle = app.handle();
            let loaded = settings::read_from_disk(handle);
            if let Some(state) = app.try_state::<SettingsState>() {
                if let Ok(mut g) = state.0.lock() {
                    *g = loaded;
                }
            }

            // ── macOS menu bar ──────────────────────────────────────────────
            // Apple guidelines: App / File / Edit / View / Window / Help.
            // Tauri provides predefined items for the standard ones; we add
            // a "Open Project Folder" custom item under File for convenience.

            let about_metadata = AboutMetadataBuilder::new()
                .name(Some("Compintel"))
                .version(Some(env!("CARGO_PKG_VERSION")))
                .copyright(Some("© 2026 now.gg / BlueStacks"))
                .build();

            let app_menu = SubmenuBuilder::new(handle, "Compintel")
                .about(Some(about_metadata))
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let open_project = MenuItemBuilder::with_id("open-project", "Open Project Folder")
                .accelerator("Cmd+Shift+O")
                .build(handle)?;

            let file_menu = SubmenuBuilder::new(handle, "File")
                .item(&open_project)
                .separator()
                .close_window()
                .build()?;

            let edit_menu = SubmenuBuilder::new(handle, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let view_menu = SubmenuBuilder::new(handle, "View").fullscreen().build()?;

            let window_menu = SubmenuBuilder::new(handle, "Window")
                .minimize()
                .maximize()
                .separator()
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(handle)
                .items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu])
                .build()?;

            app.set_menu(menu)?;

            // Wire the custom "Open Project Folder" menu item. Resolves the
            // path from settings — no longer hardcoded to /Users/bluestacks.
            app.on_menu_event(move |app, event| {
                if event.id() == "open-project" {
                    if let Some(state) = app.try_state::<SettingsState>() {
                        if let Ok(path) = settings::require_project_folder(&state) {
                            #[cfg(target_os = "macos")]
                            let _ = std::process::Command::new("open").arg(&path).spawn();
                            #[cfg(target_os = "windows")]
                            let _ = std::process::Command::new("explorer").arg(&path).spawn();
                            #[cfg(target_os = "linux")]
                            let _ = std::process::Command::new("xdg-open").arg(&path).spawn();
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Agent data (operator + viewer; degrade gracefully when no folder)
            list_competitors,
            read_run_log,
            read_last_run_summary,
            read_env_status,
            open_path,
            // Agent execution (operator only)
            start_agent,
            stop_agent,
            is_agent_running,
            // File operations (operator only)
            upload_similarweb_file,
            add_competitor,
            // Logs
            start_log_tail,
            stop_log_tail,
            // Settings
            load_settings,
            save_settings,
            get_default_project_folder,
            // Snapshot (viewer mode)
            fetch_snapshot,
            get_cached_snapshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
