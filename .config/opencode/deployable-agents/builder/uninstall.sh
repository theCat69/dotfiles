#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-$HOME/.config/opencode/agents}"

[ -L "$TARGET_DIR/builder.md" ] && rm "$TARGET_DIR/builder.md"
[ -L "$TARGET_DIR/external-context-gatherer.md" ] && rm "$TARGET_DIR/external-context-gatherer.md"
[ -L "$TARGET_DIR/librarian.md" ] && rm "$TARGET_DIR/librarian.md"
[ -L "$TARGET_DIR/local-context-gatherer.md" ] && rm "$TARGET_DIR/local-context-gatherer.md"
[ -L "$TARGET_DIR/reviewer.md" ] && rm "$TARGET_DIR/reviewer.md"
[ -L "$TARGET_DIR/security-reviewer.md" ] && rm "$TARGET_DIR/security-reviewer.md"
