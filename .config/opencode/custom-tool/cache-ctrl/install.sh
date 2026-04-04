# install.sh — cache-ctrl tool installer
#
# Installs cache-ctrl as:
#   1. A global CLI command at ~/.local/bin/cache-ctrl
#   2. An opencode plugin tool at .opencode/tools/cache-ctrl.ts
#
# Run from: .config/opencode/custom-tool/cache-ctrl/
# Usage: zsh install.sh

set -euo pipefail

TOOL_DIR="$(pwd)"
REPO_ROOT="$(cd "${TOOL_DIR}/../../.." && pwd)"

# ── Prerequisite checks ────────────────────────────────────

if ! command -v bun &>/dev/null; then
	echo "ERROR: bun is not installed or not in PATH. Install bun first." >&2
	exit 1
fi

# ── Ensure target directories exist ───────────────────────

mkdir -p "${HOME}/.local/bin"
mkdir -p "${REPO_ROOT}/.opencode/tools"

# ── CLI symlink ────────────────────────────────────────────
# ~/.local/bin/cache-ctrl → <cache-ctrl-dir>/src/index.ts
ln -sf "${TOOL_DIR}/src/index.ts" "${HOME}/.local/bin/cache-ctrl"
chmod +x "${TOOL_DIR}/src/index.ts"

# ── opencode plugin symlink ────────────────────────────────
# .opencode/tools/cache-ctrl.ts → <cache-ctrl-dir>/plugin.ts
ln -sf "${TOOL_DIR}/plugin.ts" "${REPO_ROOT}/.opencode/tools/cache-ctrl.ts"

# ── Install dependencies ───────────────────────────────────
# bun install is idempotent — safe to re-run
if [[ -f "${TOOL_DIR}/package.json" ]]; then
	bun install --cwd "${TOOL_DIR}"
fi

# ── Skills ────────────────────────────────────────────────
# ~/.config/opencode/skills/cache-ctrl-external/ → skills/cache-ctrl-external/
# ~/.config/opencode/skills/cache-ctrl-local/ → skills/cache-ctrl-local/
mkdir -p "${HOME}/.config/opencode/skills/cache-ctrl-external"
mkdir -p "${HOME}/.config/opencode/skills/cache-ctrl-local"
ln -sf "${TOOL_DIR}/skills/cache-ctrl-external/SKILL.md" "${HOME}/.config/opencode/skills/cache-ctrl-external/SKILL.md"
ln -sf "${TOOL_DIR}/skills/cache-ctrl-local/SKILL.md" "${HOME}/.config/opencode/skills/cache-ctrl-local/SKILL.md"

# ── Verify ─────────────────────────────────────────────────
echo "cache-ctrl installed:"
echo "  CLI     → ${HOME}/.local/bin/cache-ctrl"
echo "  Plugin  → ${REPO_ROOT}/.opencode/tools/cache-ctrl.ts"
echo "  Skills  → ${HOME}/.config/opencode/skills/cache-ctrl-{external,local}/SKILL.md"
