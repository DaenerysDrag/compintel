# Compintel — Install Guide

Compintel is now.gg's competitive intelligence desktop app. This guide walks you
through installing and configuring it as an internal tester.

Most testers want **Viewer mode** — the default. That's read-only, gives you
the dashboard, competitor cards, run history, and a quick-link to the Google
Sheet. No Python, no API keys, no project folder needed.

Operator mode (running the agent locally) is documented at the end.

---

## 1. Download

Grab the installer for your platform from the
[Releases page](https://github.com/karanmakol/compintel/releases).

| Platform | File | Size |
|---|---|---|
| macOS (Intel / Apple Silicon) | `Compintel_x.x.x_x64.dmg` | ~6 MB |
| Windows 10 / 11 (64-bit)      | `Compintel_x.x.x_x64-setup.exe` or `.msi` | ~8 MB |

---

## 2. Install

### macOS

1. Open the `.dmg`. A Finder window appears.
2. Drag `Compintel.app` into the `Applications` shortcut.
3. **First launch only** — Apple Gatekeeper will refuse the unsigned app.
   Right-click `Compintel.app` in Applications → **Open** → confirm "Open"
   in the dialog. After this once, you can launch it normally.
4. Subsequent launches: open via Launchpad or Spotlight like any other app.

### Windows

1. Double-click the `.msi` (or `setup.exe`).
2. **First launch only** — Windows SmartScreen will show "Windows protected
   your PC". Click **More info** → **Run anyway**.
3. The installer copies Compintel to `Program Files` and adds a Start menu
   shortcut. Subsequent launches: Start menu → Compintel.

> **Why the warnings?** Compintel isn't code-signed yet — internal beta only.
> Production-signed builds will land before external rollout.

---

## 3. First-launch setup (Viewer mode)

When the app opens, you're in **Viewer mode** by default. Configure one thing:

1. Click **Settings** (sidebar, bottom).
2. Find **Snapshot URL** under "App Mode".
3. Paste the URL your admin gave you (looks like
   `https://drive.google.com/uc?export=download&id=…`).
4. Click **Save**.
5. Click any other tab. You should see live dashboard data within a second.

That's it. The dashboard, competitors, and history all populate from the daily
snapshot that the production agent uploads after each 8 AM IST run.

### What you can do

- **Dashboard**: lifetime stats, last run summary, per-competitor backlog bars
- **Competitors**: detail card for each competitor (CrazyGames, Poki, Y8, …)
- **History**: every agent run with date, found, blocked, email status
- **Sheets**: one-click to open the master Google Sheet in your browser
- **Settings**: switch modes, configure URL, view About

### Troubleshooting

| Symptom | Fix |
|---|---|
| "No snapshot URL configured" banner | Settings → paste URL → Save |
| "showing cached snapshot" warning | You're offline. Refresh when back online via the ↻ button in Dashboard. |
| Empty Dashboard | Either the URL is wrong (admin will know) or the agent hasn't run yet today. |
| Can't open on macOS ("damaged") | Run `xattr -dr com.apple.quarantine /Applications/Compintel.app` in Terminal, then retry. |

---

## 4. Operator mode (advanced, optional)

Operator mode runs the Python agent locally on your machine. You only need this
if you're going to actively run/edit the agent — most testers should stay in
Viewer mode.

### Requirements

- Python 3.10 or newer
- Google OAuth credentials (token.json) — get from admin
- Local copy of the `Compitior Analysis` project folder
- API keys for GitHub + Tavily in `.env`

### Switch modes

1. Settings → click **Operator** under App Mode.
2. Click **Pick…** under "Project folder" and select your local
   `Compitior Analysis` directory.
3. The **Run Agent** tab becomes available — click it to spawn `run_agent.py`
   exactly like launchd does.

Read `Agent/CLAUDE.md` in the project folder for the full operator runbook.

---

## 5. Updating

When a new version drops, GitHub Releases will have a new tag (e.g., `v0.3.0`).
Download the installer the same way and overwrite the previous install:

- **macOS**: replace `Compintel.app` in Applications. Settings carry over (stored
  in `~/Library/Application Support/com.nowgg.compintel/`).
- **Windows**: run the new `.msi`. The installer auto-upgrades.

Your snapshot URL, mode, and project folder persist across updates.

---

## 6. Feedback

Found a bug, want a feature, or have a question? Slack
**@karan.makol** or file an issue at
`github.com/karanmakol/compintel/issues`.

— *Compintel team*
