#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Optional target directory forwarded to every agent uninstaller.
# Defaults to $HOME/.config/opencode/agents (same default as each uninstall.sh).
TARGET_DIR="${1:-$HOME/.config/opencode/agents}"

agents=(ask implementer planner)

for agent in "${agents[@]}"; do
  uninstaller="$SCRIPT_DIR/$agent/uninstall.sh"
  echo "→ Uninstalling $agent agent…"
  bash "$uninstaller" "$TARGET_DIR"
done

echo "✓ All agents uninstalled from $TARGET_DIR"
