# Compintel — Desktop App Project

**Compintel** is now.gg's competitive intelligence desktop app. It wraps the existing Python pipeline agent in a polished UI with a "Jarvis"-style live execution view.

**Status:** V1 (M1–M4) complete and installable as `.dmg`. Daily-driver ready.
**Started:** 2026-05-23.
**Rebrand:** 2026-05-25 (was previously "now.gg Agent" during M1–M4 build).
**Side project pace:** No deadline pressure. Quality bar over speed.

---

## Why This Exists

The Python agent works and runs daily via launchd. But:
- Running it manually = `python3 run_agent.py --competitor "Poki"` in a terminal
- Output is stdout text — invisible unless you tail the log
- Adding a competitor = creating a folder + dropping a file + editing CLAUDE.md
- Daily reports live in Gmail and a Google Sheet — no consolidated view

The frontend solves the friction without touching the engine. The agent's correctness is already audited; this project is about **visibility and ergonomics**.

---

## Core Principle — Do Not Tamper With the Live Agent

The Python agent under `Agent/Scripts/` runs every weekday at 8 AM IST via launchd. **Nothing in this Frontend project may modify the agent's source files, configuration, or scheduled run.**

The contract:

| Agent owns | Frontend owns |
|---|---|
| All `Agent/Scripts/*.py` files | Everything in `Frontend/` |
| launchd plist files | UI state, window position, theme |
| `token.json`, `.env`, `gsc_credentials.json` | Cached views of agent output |
| Google Sheet writes | Sheet *reads* (embedded view) |
| Gmail sends | Email *previews* |
| `confirmed_sources.json`, `gsc_data.csv` | Reading these for display |

**The "Run Now" button executes the same command launchd already uses:**
```
python3 /path/to/Agent/Scripts/run_agent.py [--competitor "Name"]
```
No wrappers. No mutations. The Python process is the source of truth.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | **Tauri 2.x** | 10-15 MB binaries vs Electron's 150 MB. Native macOS performance. |
| Language (shell) | **Rust** | Tauri's required backend. Handles subprocess + IPC. |
| Language (UI) | **TypeScript** | Type safety across the IPC boundary |
| UI framework | **React 18** | Largest ecosystem, easy to port to web later |
| Styling | **Tailwind CSS** | Matches the aesthetic of the agent-workflow.html |
| Animation | **Framer Motion** | Jarvis-style transitions in 10 lines instead of 100 |
| State | **Zustand** | Lighter than Redux, simpler than Context for this scope |
| Build | **Vite** | Tauri default; instant HMR during dev |
| Subprocess | **Tauri sidecar API** | Spawn Python, stream stdout to UI |
| Charts (later) | **Recharts** | Lightweight, React-native, no D3 learning curve |

---

## Folder Structure

```
Compitior Analysis/
├── Agent/                              ← FROZEN. The Python pipeline. Untouched.
│   ├── Scripts/
│   │   ├── run_agent.py
│   │   ├── 1_gsc_puller.py ... 8_sheets_uploader.py
│   │   └── token.json, .env (sacred)
│   └── CLAUDE.md
│
├── Frontend/                           ← NEW. This project.
│   ├── PROJECT.md                      ← you are here
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   │
│   ├── src/                            ← React + TypeScript UI
│   │   ├── main.tsx                    ← React entry point
│   │   ├── App.tsx                     ← top-level shell with tab router
│   │   ├── theme.css                   ← Tailwind globals + design tokens
│   │   │
│   │   ├── tabs/                       ← one file per tab (lazy-loaded)
│   │   │   ├── Dashboard.tsx
│   │   │   ├── RunAgent.tsx            ← contains the Jarvis screen
│   │   │   ├── Competitors.tsx
│   │   │   ├── History.tsx
│   │   │   ├── Sheets.tsx
│   │   │   └── Settings.tsx
│   │   │
│   │   ├── components/                 ← shared UI primitives
│   │   │   ├── TabBar.tsx
│   │   │   ├── JarvisRing.tsx          ← the animated central ring
│   │   │   ├── StepNode.tsx            ← Part 1..6 nodes
│   │   │   ├── LiveLog.tsx             ← stdout stream panel
│   │   │   ├── GameCard.tsx            ← per-game animated card
│   │   │   └── ...
│   │   │
│   │   ├── lib/                        ← non-React utilities
│   │   │   ├── ipc.ts                  ← Tauri command + event wrappers
│   │   │   ├── agentPaths.ts           ← resolves the Agent/Scripts/ paths
│   │   │   ├── parseStdout.ts          ← turns Python prints into UI events
│   │   │   └── trackingList.ts         ← reads game-tracking-list.md
│   │   │
│   │   └── store/                      ← Zustand state stores
│   │       ├── runStore.ts             ← active-run progress
│   │       ├── competitorStore.ts
│   │       └── settingsStore.ts
│   │
│   └── src-tauri/                      ← Rust shell
│       ├── Cargo.toml
│       ├── tauri.conf.json             ← window size, permissions, icons
│       ├── icons/
│       └── src/
│           ├── main.rs                 ← Tauri entrypoint
│           └── commands/               ← Rust commands callable from JS
│               ├── run_agent.rs        ← spawn python3 run_agent.py
│               ├── read_files.rs       ← read CLAUDE.md, sheets data
│               └── fs_watch.rs         ← watch for output file changes
```

---

## Tabs (V1)

### 1. Dashboard
**Purpose:** At-a-glance health of the pipeline.

Shows:
- Last run: date, competitor, ✅/❌/⚠️ counts
- Total ✅ across all competitors (lifetime)
- Backlog health bar per competitor (🟢/🟡/🔴 with day estimate)
- Token expiry countdown (yellow if <14 days)
- SimilarWeb file age per competitor (red if >60 days)
- Quick links: Open Sheet · View Latest Handoff · Run Now

Data source: parses `Agent/CLAUDE.md` + tracking lists.

### 2. Run Agent (with Jarvis Screen)
**Purpose:** Trigger a run, watch it execute live, see results.

Pre-run state:
- Dropdown to pick competitor
- "Run Now" button (large, primary)
- Optional flags: "Force-run on weekend?" (passes `--competitor` to bypass weekend skip)

Running state — the **Jarvis Screen**:
- **Center**: Large rotating ring around the current step's icon
- **Around center**: 6 step nodes (Part 1 → Part 6) with state (pending/active/done/failed)
- **Right panel**: Live stdout stream with smooth scroll, monospace, syntax-highlighted
- **Bottom strip**: Game cards slide in as each is investigated (✅ green glow, ⚠️ yellow, ❌ red dim)
- **Top bar**: Elapsed time, current competitor name, "Stop" button

Done state:
- Big counter: "5 Deploy Ready · 2 Need Review · 13 Investigated"
- Game card grid with rich details (license, stars, link)
- Buttons: Open Sheet · Open Handoff · Send Email Again · View History

### 3. Competitors
**Purpose:** Add, view, and manage competitor folders.

For each competitor card:
- Name + folder status (exists / needs setup)
- SimilarWeb file: name + age (with red dot if stale)
- nowgg-existing-games.csv age
- Investigation progress: progress bar with ✅/❌/⚠️ breakdown
- "Drag & drop new SimilarWeb file here" zone
- "Open Folder" button

"Add Competitor" flow:
- Name input (validated: `[A-Za-z0-9 ._-]{1,40}`)
- Drag-drop the SimilarWeb file
- Frontend writes the file into the folder (this is allowed — it's user data, not agent source)
- Click "Run Setup" → triggers `run_agent.py --competitor "Name"`

### 4. History
**Purpose:** Browse all past runs.

Table view:
- Date · Competitor · Investigated · ✅ Found · ❌ Blocked · Email status
- Click a row → drill-down panel with full game list + handoff link
- Search/filter by competitor

Data source: parses the Agent Run Log table in `Agent/CLAUDE.md`.

### 5. Sheets
**Purpose:** Quick access to the Google Sheet without leaving the app.

- Embedded iframe of the master sheet
- Per-competitor tab switcher
- "Open in browser" button for full editing

### 6. Settings
**Purpose:** Configuration and diagnostics.

Sections:
- **Tokens:** OAuth token expiry, `auth_setup.py` re-run button
- **API Keys:** Display masked GitHub token + Tavily key, "Edit .env" button (opens in default editor)
- **Schedule:** launchd job status (running / disabled), next-fire time
- **Logs:** Tail `/tmp/nowgg-agent.log` and `/tmp/nowgg-weekly-digest.log` live
- **Paths:** Display all relevant filesystem locations
- **About:** Frontend version, agent version, link to GitHub repo (if applicable)

---

## IPC Contract (Rust ↔ React)

### Commands (React calls Rust)

| Command | Args | Returns | Purpose |
|---|---|---|---|
| `run_agent` | `competitor?: string` | `RunHandle` | Spawn python3 run_agent.py |
| `stop_agent` | `runId: string` | `void` | SIGTERM the running subprocess |
| `read_claude_md` | `which: "agent" \| "competitor"` | `string` | Read CLAUDE.md content |
| `read_tracking_list` | `competitorSlug: string` | `TrackingRow[]` | Parse game-tracking-list.md |
| `read_confirmed_sources` | — | `Source[]` | Read confirmed_sources.json |
| `list_competitor_folders` | — | `Competitor[]` | Scan for "* vs Now.gg" folders |
| `read_run_log` | — | `RunLogRow[]` | Parse Agent Run Log table |
| `read_env_status` | — | `EnvStatus` | Token expiry, API keys present, file ages |
| `drop_similarweb_file` | `competitorSlug: string`, `filePath: string` | `void` | Copy file into competitor folder |
| `tail_log` | `which: "daily" \| "weekly"` | `void` | Start tailing the log file |
| `open_path` | `path: string` | `void` | Open file or folder in Finder |

### Events (Rust emits to React)

| Event | Payload | Emitted When |
|---|---|---|
| `agent:stdout` | `{ runId, line, timestamp }` | Python stdout line received |
| `agent:stderr` | `{ runId, line, timestamp }` | Python stderr line received |
| `agent:step` | `{ runId, step, status }` | Parsed step transition |
| `agent:game` | `{ runId, game, status, url? }` | Per-game result |
| `agent:done` | `{ runId, exitCode, durationMs }` | Subprocess exited |
| `log:line` | `{ which, line }` | New line in tailed log file |
| `file:changed` | `{ path }` | Watched file modified |

---

## Step-State Parser (`lib/parseStdout.ts`)

The agent's Python `print()`s are mostly human-readable. We map them to typed events:

| Stdout pattern | Maps to event |
|---|---|
| `Part 1: Pulling GSC data...` | `step: "part-1", status: "started"` |
| `Part 1: Done ✅` | `step: "part-1", status: "done"` |
| `Part N: FAILED ❌` | `step: "part-N", status: "failed"` |
| `Investigating game N of M: GAME_NAME...` | `game: { name, idx }` |
| `✅ Confirmed: URL` | `game: { name, status: "confirmed", url }` |
| `⚠️ Needs review: URL` | `game: { name, status: "needs-review", url }` |
| `❌ No usable source found` | `game: { name, status: "blocked" }` |

Anything not matched goes to the raw stdout stream in the right-side panel.

**Future**: Once we add the `--json-status` opt-in flag to the agent (week 2-3), this parser becomes a fallback and structured JSON becomes primary.

---

## Design System

**Theme:** Dark tech. Cyan-purple-green accents on near-black background. Same vibe as `agent-workflow.html`.

**Tokens:**
```
--bg:       #050b14
--bg-2:     #0a1628
--glass:    rgba(10, 22, 40, 0.75)
--cyan:     #00c8ff
--green:    #00e87a
--yellow:   #ffcc00
--orange:   #ff8c00
--purple:   #a855f7
--red:      #ff4444
--text:     #d0e8ff
--text-dim: #6a8aaa
```

**Typography:** System UI for body. JetBrains Mono for stdout/log panels.

**Glass effect:** `backdrop-filter: blur(12px)` on cards.

**Glow:** Borders glow in the card's accent colour (cyan / green / etc.) with a tight `box-shadow`.

**Motion:**
- Tab transitions: 200 ms ease-out
- Step transitions: 400 ms spring (Framer Motion `spring`)
- Game card entrance: 300 ms with slight Y offset
- Jarvis ring: continuous 4 s rotation

---

## Milestones

### Milestone 1 — Foundation (Week 1, ~2 sessions)
- [x] Rust + Cargo installed
- [x] Tauri + React + TS scaffold
- [x] Hello World window opens
- [x] Tab bar with 6 placeholder tabs
- [x] Dark theme + Tailwind set up
- [x] Window resizes correctly, persists size

### Milestone 2 — Read-only views (Week 2)
- [x] Dashboard tab populated from CLAUDE.md
- [x] Competitors tab reads folder list + file ages
- [x] History tab parses Run Log table
- [x] Settings tab shows token + key status

### Milestone 3 — Run Agent (Week 3)
- [x] "Run Now" button spawns python3 subprocess via Tauri
- [x] Live stdout streams into a simple log panel
- [x] Basic Jarvis screen: ring + 6 step nodes
- [x] Game cards animate in as parsed from stdout

### Milestone 4 — Polish (Week 4)
- [x] SimilarWeb file upload (file picker, not drag-drop) — Tauri dialog plugin + Rust upload command with path validation
- [x] Embedded Sheet view — rebuilt as gateway/quick-links view since Google blocks iframe embeds of private sheets
- [x] Log tailing in Settings — polling-based, both daily + weekly streams
- [x] All motion smoothed — centralized SPRING_SOFT/SNAP/LOOSE tokens, applied across tab transitions + game cards + phase changes
- [x] App icon — custom SVG matching Jarvis-ring aesthetic, all macOS sizes generated via Tauri CLI
- [x] macOS menu bar — App / File / Edit / View / Window submenus with standard items + Cmd+Shift+O for Open Project Folder
- [x] DMG build script — `npm run dmg` produces signed `.app` + `.dmg`

### Milestone 5 — Structured agent contract (Week 5+, optional)
- [ ] Add `--json-status` opt-in flag to `run_agent.py` (backward compatible, launchd unaffected)
- [ ] Frontend reads structured events instead of parsing stdout
- [ ] Richer per-step substep visualizations

---

## Testing Strategy

Two separate test suites — frontend tests do **not** mix with the agent's `test_agent.py`.

- **Frontend unit tests:** Vitest + React Testing Library. Test `parseStdout`, `trackingList` parser, IPC wrappers.
- **Rust tests:** `cargo test`. Test subprocess spawning + path resolution + file watchers.
- **End-to-end:** Playwright against the dev build. Test "click Run Now → see Jarvis screen → see done state".

CI later. Local-first for now.

---

## Design References

Stored in `Frontend/design-references/`:

| File | What it captures | Used for |
|---|---|---|
| `jarvis-classic.jpeg` | Iron Man HUD: broken concentric arcs, radial ticks, yellow rotating indicator, wide-spaced J.A.R.V.I.S. typography, blueprint background | Primary inspiration for `JarvisRing.tsx`. The ring matches this layout. |
| `jarvis-compute-burst.jpg` | Orange/yellow data sphere (Vision-birth shot) — chaotic radial light streaks | Inspiration for `ComputeBurst` component, active during Part 3 (source hunting). |

**IP note:** these are reference images for an internal tool. The implementation is hand-coded SVG inspired by the aesthetic, not a copy of the original assets. For any public release, swap to original-or-licensed visual assets.

---

## Lottie Animation Shortlist

`lottie-react` is installed and the `JarvisRing` component accepts an optional `lottieData` JSON prop that renders inside the ring at 60% opacity behind the text. To drop one in:

1. Browse [lottiefiles.com](https://lottiefiles.com) — search terms below
2. Download the `.json` file (free tier OK for many)
3. Drop into `Frontend/src/assets/lottie/<name>.json`
4. Import: `import jarvisAnim from "../assets/lottie/jarvis-hud.json"`
5. Pass: `<JarvisRing ... lottieData={jarvisAnim} />`

**Search terms that produce the right aesthetic:**

| Term | What it returns | Best for |
|---|---|---|
| `sci-fi HUD` | Geometric circular UI, scanning rings, data overlays | The ring itself (cyan/blue) |
| `radar scan` | Sweeping radial line + ping dots | Idle/scanning states |
| `hologram interface` | Layered 3D rotation, blue glow | Background ambience |
| `cyberpunk loading` | Glitchy, neon, sharp | Loading or transition states |
| `data sphere` | Particle clouds, orbital motion | Replace `ComputeBurst` for Part 3 |
| `AI processing` | Brain/network nodes pulsing | Subtle compute indicator |
| `radial energy` | Outward bursts, orange/yellow | Confirmed-hit celebration moment |
| `glitch ring` | Circular ring with stutter effect | Failed-state ring |

**Specific creators on lottiefiles.com who consistently produce HUD-style work:**
- Search "tony stark" — fan-made HUD recreations
- "ironman" tag
- "jarvis" tag

**License gotcha:** Free Lottie animations often require attribution. For an internal tool this is fine. For redistribution, check each individual file's license.

---

## Open Questions (revisit at each milestone)

1. **Code-signing for distribution?** Apple Developer ID needed if we want others to install without "unidentified developer" warning. ~$99/year. Defer until V2.
2. **Auto-update?** Tauri supports this via signed manifest. Defer until V2.
3. **Cross-platform Windows build?** Tauri supports it, but agent uses launchd (macOS-only). Real Windows support requires porting the scheduler.
4. **Web port timing?** Decided once V1 is stable. The React tree is portable; the Tauri IPC layer is the only thing that needs replacing.

---

## Worklog

| Date | What happened |
|---|---|
| 2026-05-23 | Project initiated. Rust installed. Folder structure scaffolded. PROJECT.md written. |
| 2026-05-23 | M1 done — Tauri+React+TS scaffold, dark theme, tab bar with animated active indicator, 1280×800 window. |
| 2026-05-23 | M2 done — Rust IPC layer (`agent_data.rs` with 5 commands), TS types + ipc wrapper, Dashboard / Competitors / History / Settings tabs all populated from real agent files. Run + Sheets remain placeholders. |
| 2026-05-24 | M3 done — Run Agent tab. Rust subprocess (`run_agent.rs`) spawns `python3 run_agent.py`, streams stdout+stderr as `agent:stdout` Tauri events, emits `agent:done` on exit. TS parser (`parseStdout.ts`) maps Python prints to typed events (step start/done/failed, game start, game result confirmed/needs-review/blocked, cross-skip). Zustand `runStore` tracks runId/running/steps/games/logs. Jarvis UI: rotating ring with conic-gradient sweep, 7-node step flow with active/done/failed states, auto-scrolling LiveLog panel, animated GameStrip with colored borders. Run / Stop / status pills / elapsed timer wired. Sheets tab remains placeholder for M4. |
| 2026-05-24 | M3.5 (visual polish) — Added weekend-detection banner + Demo Run mode (scripted stdout, no APIs, "◇ DEMO MODE" badge). Reference images saved to `design-references/`. JarvisRing fully rebuilt in SVG matching `jarvis-classic.jpeg`: 60 outer tick marks (every-5th-major), main bright broken ring with gradient + glow filter + gap at top/bottom, signature rotating yellow indicator (8s loop), 36 inner ticks, broken inner arc, pulsing innermost ring. Each ring layer rotates at a different speed in alternating directions. Wide-spaced uppercase center text with status dot (○ IDLE / ● ACTIVE / ● COMPUTING / ● FAILED). Compute-burst mode (Image 2 inspired): 24 animated orange/yellow radial streaks + radial gradient haze, fires only during Part 3 (source hunting). `lottie-react` installed; ring accepts an optional `lottieData` prop for future drop-in. |
| 2026-05-24 | M3.6 — Yellow indicator alignment fix. Moved from `r=108` (main thick ring, where it overlapped awkwardly) to `r=131` (outer tick ring). Locked it into the same rotation group as the tick marks so they rotate together — yellow no longer "slides past" the cyan ring. Shrunk arc width 24°→12°. Added two carrier dots ±18° from indicator to match reference. Main cyan ring gaps shrunk 24°→16°. Removed visual-noise accent arcs. |
| 2026-05-25 | M4 — Polish session 1. **File upload:** `@tauri-apps/plugin-dialog` installed; new Rust `file_ops.rs` with `upload_similarweb_file` command (validates .xlsx extension, target folder must exist inside project root, refuses writes into `Agent/Scripts/`); Competitors tab gains per-card "Upload SimilarWeb file" button → native file picker → copy → success/error toast → auto-refresh. **Sheets tab:** new `Sheets.tsx` with embedded iframe (Karan's master sheet ID hardcoded for V1), SHEETS_ID status indicator, "Open in browser" fallback. **Log tailing:** new Rust `log_tail.rs` (polling-based, 800ms ticks, no extra crates, handles rotation/truncation, dumps last 50 KB on start); new `LogTail.tsx` component subscribed to `log:line` events with start/stop buttons per channel; Settings tab "Live Logs" card shows both daily + weekly streams. App.tsx Placeholder component removed (no more "Coming soon" tabs). |
| 2026-05-25 | M4 — Polish session 2 (closing out). **Permissions:** added `dialog:default`, `dialog:allow-open`, scoped `opener:allow-open-url` for http/https to `capabilities/default.json` (file picker + browser-open were broken without these). **Sheets rebuild:** discovered Google blocks iframe embeds of private sheets (cookies don't pass through Tauri webview); replaced iframe with a polished gateway view — hero card with big "Open Sheet in Browser ↗", per-competitor quick-link cards, explainer card on why it opens externally. **App icon (initial pass):** designed `source-icon.svg` (1024×1024, broken cyan ring + yellow indicator + tick marks + "NGG" mark, matching JarvisRing); generated all sizes via `@tauri-apps/cli icon`. **Menu bar:** Tauri 2 menu API — App / File / Edit / View / Window submenus with standard predefined items + custom "Open Project Folder" with Cmd+Shift+O accelerator. **Motion polish:** added `src/lib/motion.ts` with SPRING_SOFT/SNAP/LOOSE tokens + ROTATE_SLOW/MEDIUM/FAST + FADE_QUICK; applied SPRING_SOFT to tab transitions, GameStrip card entrances, RunAgent phase changes — feels more cohesive. **DMG build:** updated `tauri.conf.json` bundle config (category, description, minimumSystemVersion 11.0, macOS exception domain); ran `npm run tauri build` — produced `.app` cleanly; Tauri's built-in `bundle_dmg.sh` failed (AppleScript styling issue) so built DMG manually with hdiutil; created `scripts/build-dmg.sh` wrapper + `npm run dmg` shortcut for future rebuilds. **Final artifacts:** `now.gg Agent.app` (~40 MB) + `now.gg Agent_0.1.0_x64.dmg` (5.5 MB) at `src-tauri/target/release/bundle/`. M4 fully closed out. |
| 2026-05-25 | M4.1 — Logo rebrand. User-supplied logo (three overlapping rhombuses in purple/blue/teal gradient with white center diamond, 1254×1254) replaces the hand-coded Jarvis-ring icon. Copied to `src-tauri/icons/source-icon.png` + `src/assets/logo.png`. Removed old `source-icon.svg`. Regenerated all macOS/Windows/iOS/Android icon variants via `@tauri-apps/cli icon`. Sidebar in `App.tsx` now shows the logo at 40×40 next to the brand text (replaces text-only header). Rebuilt `.app` + `.dmg` with `npm run dmg`. Also fixed a zsh `NULL_GLOB` issue in `build-dmg.sh` so the partial-DMG cleanup doesn't fail when no leftovers exist. New artifacts: `now.gg Agent_0.1.0_x64.dmg` (6.2 MB, up from 5.5 due to higher-res icon set). |
| 2026-05-25 | M4.2 — **Full rebrand to "Compintel"**. App name everywhere: `tauri.conf.json` (productName, window title, descriptions), bundle identifier `com.nowgg.agent` → `com.nowgg.compintel`, Cargo crate `nowgg-agent` → `compintel`, lib name `nowgg_agent_lib` → `compintel_lib`, package.json name. **macOS menu bar:** "now.gg Agent" submenu → "Compintel"; About dialog name → "Compintel". **Sidebar:** redesigned to lead with the "Compintel" wordmark + "COMPETITIVE INTEL" tagline instead of the old "NOW.GG / Competitor / Analysis Agent" stacked text. **Settings About card:** rewritten. **DMG script:** volume name + output filename → Compintel. **PROJECT.md header:** retitled. Agent-side paths (`/tmp/nowgg-agent.log`, demo scripted stdout that mimics agent output, the real Google Sheet's title) deliberately preserved — those belong to the agent, not the frontend. Rebuilt with `npm run dmg`. New artifact: `Compintel_0.1.0_x64.dmg`. Note: bundle ID change means macOS treats new install as a different app — old "now.gg Agent" will not be auto-replaced; uninstall manually if desired. |
| 2026-05-25 | M4.3 — **"Add Competitor" in-app flow**. No more terminal needed to onboard a new competitor. New Rust command `add_competitor(name)` in `file_ops.rs`: validates name (same regex as the Python agent), refuses to overwrite existing folder, creates `{name} vs Now.gg/` + `Gap Analysis/` + `Tech Handoff/` subfolders, writes `game-tracking-list.md` with the **byte-for-byte same format** as `setup_new_competitor()` in `run_agent.py`. Pure Rust — no subprocess — to keep it fast (<50 ms) and avoid race conditions with the live agent. TS `ipc.addCompetitor(name)` wrapper. New `AddCompetitorForm` component in Competitors tab: inline form with live validation matching Rust rules, Enter/Escape keyboard shortcuts, animated slide-in via Framer Motion, success banner that points the user to the next step ("click Upload SimilarWeb file on the new card"). "+ Add Competitor" button moved to the top-right of the Competitors tab header with cyan glow. Competitors chunk grew 5.4 KB → 8.4 KB. New DMG rebuilt with feature. |
