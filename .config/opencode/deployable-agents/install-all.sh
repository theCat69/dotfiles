#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Optional target directory forwarded to every agent installer.
# Defaults to $HOME/.config/opencode/agents (same default as each install.sh).
TARGET_DIR="${1:-$HOME/.config/opencode/agents}"

agents=(ask builder implementer planner)

for agent in "${agents[@]}"; do
  installer="$SCRIPT_DIR/$agent/install.sh"
  echo "→ Installing $agent agent…"
  bash "$installer" "$TARGET_DIR"
done

echo "✓ All agents installed to $TARGET_DIR"
