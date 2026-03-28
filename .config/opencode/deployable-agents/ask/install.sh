TARGET_DIR="${1:-$HOME/.config/opencode/agents}"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

[ -e "$TARGET_DIR/ask.md" ] && rm "$TARGET_DIR/ask.md"

ln -s "$SOURCE_DIR/ask.md" "$TARGET_DIR/ask.md"
