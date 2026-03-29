#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-$HOME/.config/opencode/agents}"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$SOURCE_DIR/../shared/subagents"

mkdir -p "$TARGET_DIR"

[ -e "$TARGET_DIR/ask.md" ] && rm "$TARGET_DIR/ask.md"
[ -e "$TARGET_DIR/external-context-gatherer.md" ] && rm "$TARGET_DIR/external-context-gatherer.md"
[ -e "$TARGET_DIR/librarian.md" ] && rm "$TARGET_DIR/librarian.md"
[ -e "$TARGET_DIR/local-context-gatherer.md" ] && rm "$TARGET_DIR/local-context-gatherer.md"
[ -e "$TARGET_DIR/reviewer.md" ] && rm "$TARGET_DIR/reviewer.md"
[ -e "$TARGET_DIR/security-reviewer.md" ] && rm "$TARGET_DIR/security-reviewer.md"

ln -s "$SOURCE_DIR/ask.md" "$TARGET_DIR/ask.md"
ln -s "$SHARED_DIR/reviewer.md" "$TARGET_DIR/reviewer.md"
ln -s "$SHARED_DIR/security-reviewer.md" "$TARGET_DIR/security-reviewer.md"
ln -s "$SHARED_DIR/librarian.md" "$TARGET_DIR/librarian.md"
ln -s "$SHARED_DIR/local-context-gatherer.md" "$TARGET_DIR/local-context-gatherer.md"
ln -s "$SHARED_DIR/external-context-gatherer.md" "$TARGET_DIR/external-context-gatherer.md"
