#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="Bladydora To Do"
APP_DIR="$ROOT_DIR/dist/${APP_NAME}.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
ICONSET_DIR="$ROOT_DIR/dist/AppIcon.iconset"

rm -rf "$APP_DIR" "$ICONSET_DIR" "$ROOT_DIR/dist/AppIcon.icns"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR" "$ICONSET_DIR"

ICONSET_DIR="$ICONSET_DIR" ICNS_PATH="$RESOURCES_DIR/AppIcon.icns" python3 "$ROOT_DIR/macos/make_icon.py"

clang \
  -fobjc-arc \
  -framework Cocoa \
  -framework WebKit \
  "$ROOT_DIR/macos/BladydoraToDoApp.m" \
  -o "$MACOS_DIR/BladydoraToDo"

cp "$ROOT_DIR/server.mjs" "$RESOURCES_DIR/server.mjs"
cp "$ROOT_DIR/package.json" "$RESOURCES_DIR/package.json"
cp "$ROOT_DIR/README.md" "$RESOURCES_DIR/README.md"
cp -R "$ROOT_DIR/public" "$RESOURCES_DIR/public"
cp -R "$ROOT_DIR/data" "$RESOURCES_DIR/data"

cat > "$CONTENTS_DIR/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>zh_CN</string>
  <key>CFBundleDisplayName</key>
  <string>Bladydora To Do</string>
  <key>CFBundleExecutable</key>
  <string>BladydoraToDo</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>com.bladydora.todo</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Bladydora To Do</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
  </dict>
</dict>
</plist>
PLIST

chmod +x "$MACOS_DIR/BladydoraToDo"
echo "$APP_DIR"
