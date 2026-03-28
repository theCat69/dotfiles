TARGET_DIR="${1:-$HOME/.config/opencode/agents}"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

[ -e "$TARGET_DIR/Planner.md" ] && rm "$TARGET_DIR/Planner.md"
[ -e "$TARGET_DIR/feature-designer.md" ] && rm "$TARGET_DIR/feature-designer.md"
[ -e "$TARGET_DIR/feature-reviewer.md" ] && rm "$TARGET_DIR/feature-reviewer.md"
[ -e "$TARGET_DIR/context-gatherer.md" ] && rm "$TARGET_DIR/context-gatherer.md"

ln -s "$SOURCE_DIR/Planner.md" "$TARGET_DIR/Planner.md"
ln -s "$SOURCE_DIR/subagents/"* "$TARGET_DIR/"
