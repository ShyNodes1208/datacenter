#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

VERSION="${1:-v2.0.0}"
VERSION_TAG="${VERSION#v}"
ARTIFACT_DIR="$ROOT/artifacts/windows-$VERSION_TAG"
STAGING_DIR="$ARTIFACT_DIR/datacenter-$VERSION_TAG-win-x64"
ZIP_PATH="$ARTIFACT_DIR/datacenter-$VERSION_TAG-win-x64.zip"
API_DIR="$ROOT/src/backend/Datacenter.Api"
FRONTEND_DIR="$ROOT/src/frontend"
WWWROOT_DIR="$API_DIR/wwwroot"

echo "==> Building frontend"
cd "$FRONTEND_DIR"
npm ci
npm run build

echo "==> Preparing wwwroot"
rm -rf "$WWWROOT_DIR"
mkdir -p "$WWWROOT_DIR"
cp -a dist/. "$WWWROOT_DIR/"

echo "==> Publishing win-x64 self-contained backend"
cd "$ROOT"
rm -rf "$STAGING_DIR"
dotnet publish "$API_DIR/Datacenter.Api.csproj" \
  -c Release \
  -r win-x64 \
  --self-contained true \
  -p:PublishSingleFile=false \
  -o "$STAGING_DIR"

echo "==> Adding launcher and import templates"
cp "$ROOT/scripts/package/Start-Datacenter.bat" "$STAGING_DIR/"
cp "$ROOT/scripts/package/Reset-Datacenter-Data.bat" "$STAGING_DIR/"
cp "$ROOT/scripts/package/README-windows.txt" "$STAGING_DIR/"
cp "$ROOT/scripts/package/appsettings.Package.json" "$STAGING_DIR/"
mkdir -p "$STAGING_DIR/import-templates"
cp -a "$ROOT/scripts/package/import-templates/." "$STAGING_DIR/import-templates/"
cp "$ROOT/docs/导入文件格式说明.md" "$STAGING_DIR/import-templates/"

echo "==> Creating zip"
mkdir -p "$ARTIFACT_DIR"
rm -f "$ZIP_PATH"
(
  cd "$ARTIFACT_DIR"
  zip -r "$(basename "$ZIP_PATH")" "$(basename "$STAGING_DIR")"
)

echo "==> Package ready: $ZIP_PATH"
ls -lh "$ZIP_PATH"
