# Compintel Frontend — Session Memory

Last updated: 2026-06-07
Status: V0.2.0 distribution-ready cut complete on local disk. Git repo initialized, initial commit `df2ecbf` on `main`. Not pushed to a remote yet.

---

## What This Project Is

Compintel is now.gg's competitive intelligence desktop app — Tauri 2 + React 19 + TypeScript wrapper around the Python competitor-analysis pipeline. V1 (M1–M4) was Mac-only, single-user, hardcoded to one developer's filesystem. V0.2.0 reshapes it into a distributable product that internal testers on Mac AND Windows can install and use without engineering help.

See `PROJECT.md` for the original architecture and milestone log; this file is the running session memory.

---

## Where We Are Right Now (2026-06-07)

### Last session: Distribution-ready V0.2.0 cut

**Goal:** Take V1 from "works on Karan's Mac" to "installable .dmg + .msi that any tester in the org can use."

**Architecture decision (the big fork):** Most users get **Viewer mode** — read-only, no Python, no API keys, no project folder. They paste a snapshot URL and see live dashboard data. Operator mode (running the agent locally) stays available but is opt-in via Settings.

**Other decisions:**
- Cross-platform builds via GitHub Actions (cross-compile both Mac + Windows from CI, no Windows machine needed)
- **Unsigned** binaries for the first cut — internal audience can right-click Open on Mac, click "Run anyway" on Windows. Code signing ($400+/yr) deferred until external rollout.
- Cloud snapshot lives on Google Drive (reuses the agent's existing OAuth — zero new infrastructure)
- Personal GitHub repo for V1; can migrate to org repo later

### Tasks completed this session (all 8)

| # | What | Files |
|---|---|---|
| 7 | Viewer/Operator mode toggle, persisted across launches | `src/store/settingsStore.ts`, `src-tauri/src/settings.rs`, `src/App.tsx` |
| 8 | Removed 5 hardcoded `/Users/bluestacks` paths; all paths now resolved from user-configured project folder | `src-tauri/src/agent_data.rs`, `file_ops.rs`, `run_agent.rs`, `lib.rs` |
| 9 | Python Part 9: `9_state_snapshot.py` writes `compintel-state.json` + uploads to Google Drive after every agent run | `Agent/Scripts/9_state_snapshot.py`, `Agent/Scripts/run_agent.py` |
| 10 | Viewer fetches snapshot via Rust `ureq`, caches locally for offline; unified `useAgentData` hook switches between operator (Tauri commands) and viewer (snapshot) seamlessly | `src/store/snapshotStore.ts`, `src/lib/useAgentData.ts`, `src-tauri/src/snapshot.rs`, `src/tabs/Dashboard.tsx` |
| 11 | Tauri bundle config: `dmg` + `app` + `nsis` (Windows .msi) targets, v0.2.0 metadata | `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `package.json` |
| 12 | GitHub Actions CI: tag-triggered build for macOS + Windows in parallel, drafts a release with both installers attached | `.github/workflows/release.yml` |
| 13 | `INSTALL.md` — onboarding for non-technical testers covering Mac Gatekeeper bypass + Windows SmartScreen workaround | `INSTALL.md` |
| 14 | Git init + initial commit `df2ecbf` on `main` (111 files) | `.git/`, `.gitignore` |

### State after this session

- **Compiles clean:** `cargo check` ✅ · `tsc --noEmit` ✅
- **Tests:** 137/137 Python tests still pass (Agent/Scripts/test_agent.py)
- **Binary not rebuilt yet** — distribution `.dmg` / `.msi` will be produced by the CI workflow on first tag push
- **Settings stored:** `~/Library/Application Support/com.nowgg.compintel/compintel-settings.json` (macOS) — same path works on Windows (`%APPDATA%`)

---

## What Got Built In Detail

### Viewer Mode (the default)

Read-only. App loads snapshot JSON from a URL, renders Dashboard/Competitors/History from that. No Python, no project folder, no API keys. Settings tab is where the user pastes the snapshot URL. Falls back to cached snapshot when offline.

### Operator Mode (advanced, opt-in)

Full local agent. User picks their local "Compitior Analysis" folder via Settings. Run Agent tab spawns `python3 run_agent.py` exactly as launchd does — no wrappers, no behavior change. This is the existing V1 functionality, now path-portable.

### Snapshot lifecycle

```
Agent run finishes
   ↓ Part 9
9_state_snapshot.py
   ↓ writes compintel-state.json locally
   ↓ uploads to Google Drive (creates file on first run, updates in place after)
   ↓ shares publicly read-only
   ↓ writes COMPINTEL_SNAPSHOT_ID back to .env so future runs update same file
Drive public URL
   ↓ admin shares URL with testers
   ↓ tester pastes into Settings → Snapshot URL → Save
Viewer Dashboard / Competitors / History populate
```

### Path resolution (no more /Users/bluestacks)

All 5 hardcoded paths replaced with `require_project_folder(state)` / `project_folder_opt(state)`. Order of resolution:
1. Persisted setting (user-configured)
2. Dev fallback (`/Users/bluestacks/...`) if it exists — keeps dev machine working
3. Error with clear "configure in Settings" message

Operator-only commands (`add_competitor`, `upload_similarweb_file`, `start_agent`) fail loud when no folder is configured. Read-only commands (`list_competitors`, `read_run_log`, `read_env_status`) degrade gracefully — return empty lists so viewer-mode UI renders correctly.

### CI workflow

`.github/workflows/release.yml`:
- Trigger: `git push origin v*` (tag) or manual via Actions UI
- Builds: `macos-latest` + `windows-latest` in parallel
- Output: GitHub Release (draft) with both installers attached
- Uses official `tauri-apps/tauri-action@v0` + caches Cargo/Node
- Code signing intentionally disabled (`TAURI_SIGNING_PRIVATE_KEY=""`)

---

## What's Half-Done — Pick Up Here Next Session

### Immediate: refactor Competitors, History, RunAgent tabs to use `useAgentData`

Dashboard is wired. The other three still call `ipc.listCompetitors()` etc. directly. **Operator mode works as-is on those tabs** (existing code path), but **Viewer mode shows empty cards** until they're refactored.

Files to update:
- `src/tabs/Competitors.tsx` — replace `ipc.listCompetitors()` with `useAgentData()`
- `src/tabs/History.tsx` — replace `ipc.readRunLog()` with `useAgentData()`
- `src/tabs/RunAgent.tsx` — RunAgent tab is operator-only (already hidden in viewer mode by App.tsx), but should show a "switch to operator mode" message if somehow opened in viewer

This is ~1–2 hours of work, the same pattern Dashboard already uses.

### Then: ship V0.2.0 to first testers

1. Create GitHub repo (private):
   ```
   gh repo create DaenerysDrag/compintel --private --source=. --remote=origin --push
   ```
   Or via github.com UI + `git remote add origin <url>` + `git push -u origin main`.
2. Tag + push to trigger CI:
   ```
   git tag v0.2.0 && git push origin v0.2.0
   ```
3. Wait ~10 min, publish the draft release from github.com
4. Get the Drive snapshot URL from a fresh agent run (the next 8 AM IST run will populate it automatically after Part 9 is wired in — already done)
5. Share Releases page + snapshot URL with 1–2 testers, gather feedback

---

## Decisions Logged (so future-me doesn't re-litigate)

| Decision | Picked | Why |
|---|---|---|
| User mode | Viewer (default) + Operator (opt-in) | Most testers shouldn't need Python or API keys |
| Cross-platform | GitHub Actions cross-compile | No Windows machine required |
| Code signing | Unsigned for V1 | Internal trusted audience; saves $400/yr; can add later |
| Snapshot host | Google Drive | Reuses existing OAuth, no new infrastructure |
| GitHub repo | Personal, private | Fast start; org migration later |
| Bundle ID | `com.nowgg.compintel` (kept) | No migration needed |
| Version | 0.2.0 (was 0.1.0) | Significant architectural change earns minor bump |
| HTTP client | `ureq` (not `reqwest`) | ~2 MB smaller bundle, blocking is fine for one-shot fetch |

---

## Files Changed This Session

**New (8):**
- `src/store/settingsStore.ts`
- `src/store/snapshotStore.ts`
- `src/lib/useAgentData.ts`
- `src-tauri/src/settings.rs`
- `src-tauri/src/snapshot.rs`
- `.github/workflows/release.yml`
- `INSTALL.md`
- `Agent/Scripts/9_state_snapshot.py` (Python side)

**Modified (12):**
- `src/App.tsx` — mode-aware tab filtering, snapshot bootstrapping
- `src/tabs/Dashboard.tsx` — switched to `useAgentData`, added viewer banner + refresh button, hid Health Checks in viewer mode
- `src/tabs/Settings.tsx` — Mode toggle UI, Snapshot URL input, Project Folder picker
- `src-tauri/src/lib.rs` — register settings + snapshot modules, eager-load settings, register new commands, mode-aware "Open Project Folder" menu item
- `src-tauri/src/agent_data.rs` — `State<SettingsState>` parameters, path resolution from settings, graceful empty returns in viewer mode
- `src-tauri/src/file_ops.rs` — same pattern, with strict "operator only" gating
- `src-tauri/src/run_agent.rs` — same pattern for subprocess spawning
- `src-tauri/Cargo.toml` — added `ureq`, bumped version
- `src-tauri/tauri.conf.json` — added `nsis` target, Windows config, v0.2.0
- `package.json` — v0.2.0
- `.gitignore` — Rust target, generated Tauri files, secrets
- `Agent/Scripts/run_agent.py` — wired Part 9 after Part 6 (non-fatal: snapshot upload failures don't break the run)

---

## Known Limitations / Watch Points

1. **Competitors/History tabs still operator-only.** Viewer mode UI renders empty cards on those tabs until they're refactored. Dashboard is the only fully wired viewer tab.
2. **No code signing.** First-launch UX is rough — Mac users right-click → Open, Windows users click through SmartScreen. INSTALL.md walks them through it.
3. **Snapshot URL is shared globally.** Public read-only Drive link. Anyone with the URL can read snapshot data. Fine for an internal tool with non-sensitive aggregate stats; revisit for any sensitive data.
4. **Snapshot updates daily, not real-time.** Tied to the agent's 8 AM IST run + manual `python3 run_agent.py` invocations. Viewer "Refresh" button re-fetches but won't show data newer than the last snapshot upload.
5. **No auto-update yet.** Testers must manually download new installers. Tauri 2 has an updater plugin — defer to V0.3 since it needs signing infrastructure.
6. **Dev fallback path still in code.** `settings.rs::require_project_folder` falls back to `/Users/bluestacks/...` if it exists. Safe (harmless on every other machine), convenient for dev. Strip before V1.0 public release.

---

## Worklog (this file)

| Date | What |
|---|---|
| 2026-06-07 | V0.2.0 distribution-ready cut. Tasks 7–14 complete. Git initialized (`df2ecbf` on `main`). Tests + builds all clean. Not yet pushed to remote, not yet built into a tagged installer. Reminded by user to write this memory file; saved a feedback memory ([[feedback-update-memory-each-session]]) so this becomes a habit. |
