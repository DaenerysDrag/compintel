// File operations the user invokes from the UI.
// Strict path validation — every operation here can only touch paths inside
// the configured project root, never `Agent/Scripts/` or anywhere else on the
// filesystem. Project root is resolved at call time from SettingsState.

use crate::settings::{require_project_folder, SettingsState};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

fn agent_scripts_dir(project_root: &Path) -> PathBuf {
    project_root.join("Agent").join("Scripts")
}

fn is_within(child: &Path, parent: &Path) -> bool {
    match (child.canonicalize(), parent.canonicalize()) {
        (Ok(c), Ok(p)) => c.starts_with(&p),
        _ => false,
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadResult {
    pub destination: String,
    pub file_name: String,
    pub bytes: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddCompetitorResult {
    pub folder: String,
    pub slug: String,
    pub name: String,
}

/// Validate a competitor name. Same rules the Python agent uses for `--competitor`.
fn validate_competitor_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("competitor name cannot be empty".into());
    }
    if name.len() > 40 {
        return Err("competitor name must be 40 chars or fewer".into());
    }
    if !name
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, ' ' | '.' | '_' | '-'))
    {
        return Err(
            "competitor name may only contain letters, digits, space, dot, underscore, hyphen"
                .into(),
        );
    }
    if name.trim().len() != name.len() {
        return Err("competitor name cannot have leading or trailing whitespace".into());
    }
    Ok(())
}

/// Today's date as YYYY-MM-DD. Doing this without chrono to keep deps small.
fn today_iso() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0) as i64;
    // Days since epoch
    let days = secs / 86_400;
    // Civil-from-days algorithm (Howard Hinnant) — exact, leap-year safe.
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{:04}-{:02}-{:02}", y, m, d)
}

/// Create a new competitor: folder structure + initial game-tracking-list.md.
/// Matches the exact format produced by `Agent/Scripts/run_agent.py:setup_new_competitor`.
/// Refuses to overwrite an existing folder.
#[tauri::command]
pub fn add_competitor(
    state: State<SettingsState>,
    name: String,
) -> Result<AddCompetitorResult, String> {
    let name = name.trim().to_string();
    validate_competitor_name(&name)?;

    let project_root = require_project_folder(&state)?;
    let scripts = agent_scripts_dir(&project_root);
    let folder = project_root.join(format!("{} vs Now.gg", name));
    if folder.exists() {
        return Err(format!(
            "competitor folder already exists: {}",
            folder.to_string_lossy()
        ));
    }

    // Defense in depth: never create anything inside Agent/Scripts.
    if folder.starts_with(&scripts) {
        return Err("refusing to create folder inside Agent/Scripts/".into());
    }
    // And folder must be inside project root.
    if !folder.starts_with(&project_root) {
        return Err("target folder is outside project root".into());
    }

    // Create folder + Gap Analysis/ + Tech Handoff/ — matches Python setup.
    let gap_folder = folder.join("Gap Analysis");
    let handoff_folder = folder.join("Tech Handoff");
    fs::create_dir_all(&gap_folder).map_err(|e| format!("create Gap Analysis/: {}", e))?;
    fs::create_dir_all(&handoff_folder).map_err(|e| format!("create Tech Handoff/: {}", e))?;

    // Write the tracking list with the exact same content as the Python version.
    let tracking_file = folder.join("game-tracking-list.md");
    let today = today_iso();
    let content = format!(
        concat!(
            "# {} vs now.gg — Game Tracking List\n\n",
            "_Last updated: {} | Source: pending gap analysis_\n\n",
            "---\n\n",
            "## Progress Summary\n\n",
            "| Status | Count |\n",
            "|---|---|\n",
            "| ✅ Source confirmed | 0 |\n",
            "| ⚠️ Needs license review | 0 |\n",
            "| ❌ No source / blocked | 0 |\n",
            "| 🔄 Already on now.gg | 0 |\n",
            "| **Total investigated** | **0** |\n\n",
            "---\n\n",
            "## Game List\n\n",
            "| # | Game | Monthly Searches | Competitor URL | Status | Notes |\n",
            "|---|---|---|---|---|---|\n",
        ),
        name, today
    );
    fs::write(&tracking_file, content).map_err(|e| format!("write tracking list: {}", e))?;

    let slug: String = name
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect();

    Ok(AddCompetitorResult {
        folder: folder.to_string_lossy().to_string(),
        slug,
        name,
    })
}

/// Copy a SimilarWeb .xlsx file into the target competitor's folder.
/// Validates: source must exist + be .xlsx, target competitor folder must
/// exist inside project root, NEVER allows writing into Agent/Scripts.
#[tauri::command]
pub fn upload_similarweb_file(
    state: State<SettingsState>,
    source_path: String,
    competitor_slug: String,
) -> Result<UploadResult, String> {
    let project_root = require_project_folder(&state)?;
    let scripts = agent_scripts_dir(&project_root);
    let source = PathBuf::from(&source_path);

    if !source.exists() {
        return Err(format!("source file does not exist: {}", source_path));
    }
    if !source.is_file() {
        return Err("source path is not a file".into());
    }

    let ext = source
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase());
    if ext.as_deref() != Some("xlsx") {
        return Err("only .xlsx files are accepted (SimilarWeb format)".into());
    }

    // Sanity-check competitor_slug — same character class as run_agent.py
    let valid_slug = !competitor_slug.is_empty()
        && competitor_slug.len() <= 40
        && competitor_slug
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, ' ' | '.' | '_' | '-'));
    if !valid_slug {
        return Err(format!(
            "invalid competitor name: {}",
            competitor_slug
        ));
    }

    // The folder must already exist — we don't auto-create it here.
    // Run setup_new_competitor first to make the folder.
    let target_folder = project_root.join(format!("{} vs Now.gg", competitor_slug));
    if !target_folder.exists() {
        return Err(format!(
            "competitor folder does not exist: {:?}. Run 'python3 run_agent.py --competitor \"{}\"' first to create it.",
            target_folder, competitor_slug
        ));
    }

    // Defense in depth: never write inside Agent/Scripts.
    if is_within(&target_folder, &scripts) {
        return Err("refusing to write inside Agent/Scripts/".into());
    }
    // And target must be inside project root.
    if !is_within(&target_folder, &project_root) {
        return Err("target folder is outside project root".into());
    }

    let file_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("uploaded.xlsx")
        .to_string();
    let dest = target_folder.join(&file_name);

    let bytes = fs::copy(&source, &dest)
        .map_err(|e| format!("copy failed: {}", e))?;

    Ok(UploadResult {
        destination: dest.to_string_lossy().to_string(),
        file_name,
        bytes,
    })
}
