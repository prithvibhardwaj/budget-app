#!/usr/bin/env bash
# Builds the Expo web bundle and stages it where the backend serves it from.
# Run from the repo root, then commit backend/public and push — Railway will
# redeploy and the new web app goes live at the same URL as the API.
#
#   bash scripts/build-web.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Building web bundle..."
cd "$ROOT/app"
rm -rf dist
npx expo export --platform web --output-dir dist

echo "Staging into backend/public..."
rm -rf "$ROOT/backend/public"
mkdir -p "$ROOT/backend/public"
cp -r dist/. "$ROOT/backend/public/"

echo "Done. Now: git add backend/public && git commit && git push"
