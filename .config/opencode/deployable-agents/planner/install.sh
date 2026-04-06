#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-$HOME/.config/opencode/agents}"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$SOURCE_DIR/../shared/subagents"

mkdir -p "$TARGET_DIR"

[ -e "$TARGET_DIR/Planner.md" ] && rm "$TARGET_DIR/Planner.md"
[ -e "$TARGET_DIR/critic.md" ] && rm "$TARGET_DIR/critic.md"
[ -e "$TARGET_DIR/feature-designer.md" ] && rm "$TARGET_DIR/feature-designer.md"
[ -e "$TARGET_DIR/feature-reviewer.md" ] && rm "$TARGET_DIR/feature-reviewer.md"
# Remove legacy context-gatherer if still present from a prior install
[ -e "$TARGET_DIR/context-gatherer.md" ] && rm "$TARGET_DIR/context-gatherer.md"
# Shared subagents
[ -e "$TARGET_DIR/external-context-gatherer.md" ] && rm "$TARGET_DIR/external-context-gatherer.md"
[ -e "$TARGET_DIR/librarian.md" ] && rm "$TARGET_DIR/librarian.md"
[ -e "$TARGET_DIR/local-context-gatherer.md" ] && rm "$TARGET_DIR/local-context-gatherer.md"
[ -e "$TARGET_DIR/reviewer.md" ] && rm "$TARGET_DIR/reviewer.md"
[ -e "$TARGET_DIR/security-reviewer.md" ] && rm "$TARGET_DIR/security-reviewer.md"

ln -s "$SOURCE_DIR/Planner.md" "$TARGET_DIR/Planner.md"
ln -s "$SOURCE_DIR/subagents/feature-designer.md" "$TARGET_DIR/feature-designer.md"
ln -s "$SOURCE_DIR/subagents/feature-reviewer.md" "$TARGET_DIR/feature-reviewer.md"
ln -s "$SHARED_DIR/critic.md" "$TARGET_DIR/critic.md"
ln -s "$SHARED_DIR/reviewer.md" "$TARGET_DIR/reviewer.md"
ln -s "$SHARED_DIR/security-reviewer.md" "$TARGET_DIR/security-reviewer.md"
ln -s "$SHARED_DIR/librarian.md" "$TARGET_DIR/librarian.md"
ln -s "$SHARED_DIR/local-context-gatherer.md" "$TARGET_DIR/local-context-gatherer.md"
ln -s "$SHARED_DIR/external-context-gatherer.md" "$TARGET_DIR/external-context-gatherer.md"
