#!/bin/zsh
# Build the production .app + .dmg for distribution.
#
# Why this exists: `npm run tauri build` produces the .app correctly but its
# built-in DMG-creation script (`bundle_dmg.sh`) fails on this machine due to
# AppleScript permission issues. We do the bundling step manually with hdiutil
# instead — same result, fewer moving parts.
#
# Usage:  ./scripts/build-dmg.sh
# Output: src-tauri/target/release/bundle/dmg/now.gg Agent_<version>_x64.dmg

set -euo pipefail

cd "$(dirname "$0")/.."
FRONTEND_DIR="$(pwd)"

# Ensure cargo is on PATH
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

echo "▶ Building .app via tauri build..."
# `|| true` because we know the DMG step inside tauri build often fails on this
# machine; the .app is built before that step, so we recover from it.
npm run tauri build 2>&1 | tail -3 || true

APP_PATH="$FRONTEND_DIR/src-tauri/target/release/bundle/macos/Compintel.app"
DMG_OUT="$FRONTEND_DIR/src-tauri/target/release/bundle/dmg/Compintel_$(node -p "require('./package.json').version")_x64.dmg"

if [ ! -d "$APP_PATH" ]; then
  echo "✗ .app not found at $APP_PATH"
  exit 1
fi

echo "▶ Staging DMG contents..."
STAGING="/tmp/nowgg-dmg-staging"
rm -rf "$STAGING"
mkdir -p "$STAGING"
cp -R "$APP_PATH" "$STAGING/"
ln -s /Applications "$STAGING/Applications"

# Wipe any partial DMG files from prior failed runs.
# `setopt NULL_GLOB` silences zsh's "no matches found" when the pattern matches nothing.
setopt NULL_GLOB
rm -f "$FRONTEND_DIR/src-tauri/target/release/bundle/dmg/"rw.*.dmg
unsetopt NULL_GLOB

echo "▶ Building DMG via hdiutil..."
hdiutil create \
  -volname "Compintel" \
  -srcfolder "$STAGING" \
  -ov \
  -format UDZO \
  "$DMG_OUT"

rm -rf "$STAGING"

echo ""
echo "✓ Done."
echo "  App: $APP_PATH"
echo "  DMG: $DMG_OUT"
echo ""
echo "Install: double-click the .dmg, drag the app to Applications."
