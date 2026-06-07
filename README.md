# Compintel

now.gg's competitive intelligence desktop app. Wraps the Python pipeline at `../Agent/` in a "Jarvis-style" GUI.

**Status:** V1 shipped (M1–M4 complete). Daily-driver ready.

## Develop

```sh
. "$HOME/.cargo/env"
npm install
npm run tauri dev
```

Opens a 1280×800 window with HMR. Edits to `src/` reload instantly; edits to `src-tauri/` recompile (~30s) then relaunch.

## Build a distributable

```sh
npm run dmg
```

Produces:
- `src-tauri/target/release/bundle/macos/Compintel.app` — ~40 MB
- `src-tauri/target/release/bundle/dmg/Compintel_0.1.0_x64.dmg` — ~6 MB

Drag the `.app` to `/Applications`. First launch on a fresh Mac will require right-click → Open to bypass Gatekeeper (no code-signing yet).

## Architecture

- **Frontend:** React 19 + TypeScript + Vite, Framer Motion for animation, Zustand for state
- **Shell:** Tauri 2 (Rust backend)
- **Subprocess model:** the agent's `python3 run_agent.py` is spawned identically to how launchd fires it — no wrappers, no edits to agent files

See `PROJECT.md` for full architecture, IPC contract, tabs, milestones, and worklog.

## Folder structure

```
Frontend/
├── PROJECT.md               ← primary memory (read this when resuming)
├── README.md                ← you are here
├── design-references/       ← Jarvis HUD inspiration imagery
├── package.json
├── tailwind.config.js
├── src/                     ← React + TypeScript
│   ├── App.tsx
│   ├── tabs/                ← one file per sidebar tab
│   ├── components/          ← Card, LogTail, Jarvis ring + step flow
│   ├── store/               ← Zustand stores
│   ├── lib/                 ← ipc, parseStdout, motion tokens, types
│   └── assets/              ← logo + Lottie animations
├── src-tauri/               ← Rust shell
│   ├── Cargo.toml
│   ├── tauri.conf.json      ← window + bundle config
│   ├── capabilities/        ← Tauri 2 permission grants
│   ├── icons/               ← app icon set + source PNG
│   └── src/                 ← Rust commands (agent_data, run_agent, file_ops, log_tail)
└── scripts/
    └── build-dmg.sh         ← `npm run dmg` calls this
```

## Tabs

| Tab | What it shows | Read-only? |
|---|---|---|
| Dashboard | Lifetime totals, backlog bars, health checks | Yes |
| Run Agent | Idle → click "Run Now" → Jarvis screen → done state. Also has Demo Run | Triggers real subprocess |
| Competitors | Per-competitor cards with progress + .xlsx upload | Writes uploaded files |
| History | Run log table | Yes |
| Sheets | Gateway to the master Google Sheet (opens in browser) | Yes |
| Settings | Token / API key status, paths, live log tailing | Yes |
