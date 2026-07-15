# Headroom with OpenCode and GitHub Copilot

Use this guide to run a local Headroom checkout as an OpenCode plugin. The plugin routes the existing GitHub Copilot provider traffic through Headroom, so continue selecting `copilot/gpt-5.6-terra` rather than a `headroom/...` model.

## Prerequisites

- OpenCode is already authenticated with GitHub Copilot.
- Python 3.13, Node.js, npm, and Git are installed.
- Do not put Copilot credentials in this repository. Keep them in the existing external environment or `~/.secrets` setup.

## 1. Clone and prepare Headroom

```bash
mkdir -p "$HOME/dev-tools"
git clone https://github.com/headroomlabs-ai/headroom.git "$HOME/dev-tools/headroom"
cd "$HOME/dev-tools/headroom"
```

Do not run `uv sync --extra dev` for this setup. The development dependency set includes `hnswlib`, which currently fails to build with Python 3.14 in this environment. The OpenCode plugin build does not require Headroom's development dependencies.

Install the proxy CLI from the checkout with Python 3.13 and only its required runtime extras:

```bash
uv tool install --python python3.13 --editable "$HOME/dev-tools/headroom[proxy,mcp]"
```

Verify it is using Python 3.13:

```bash
headroom --version
uv tool list
```

## 2. Build the OpenCode plugin

```bash
cd "$HOME/dev-tools/headroom/plugins/opencode"
npm install
npm run build
```

Verify that this file exists:

```bash
test -f "$HOME/dev-tools/headroom/plugins/opencode/dist/entry.opencode.js"
```

## 3. Configure OpenCode

Create a symlink between entry.opencode.js and opencode plugin directory.

```bash
ln -s $HOME/dev-tools/headroom/plugins/opencode/dist/entry.opencode.js $HOME/.config/opencode/plugins/entry.opencode.js
```

The plugin reads `HEADROOM_PROXY_URL`; it does not add model definitions. Keep using the normal Copilot model ID:

```text
copilot/gpt-5.6-terra
```

Do not use `headroom/gpt-5.6-terra`: Headroom's generated `headroom` provider does not currently list that model.

## 4. Start Headroom and OpenCode

Run the proxy in one terminal:

```bash
HEADROOM_PROXY_URL=http://127.0.0.1:8787 headroom proxy --port 8787
```

Start OpenCode from a second terminal with the same proxy URL:

```bash
HEADROOM_PROXY_URL=http://127.0.0.1:8787 opencode
```

Select `copilot/gpt-5.6-terra` in OpenCode as usual.

## Verify

In the OpenCode session, make a short request with `copilot/gpt-5.6-terra`. The plugin adds `HEADROOM_ACTIVE=1` to OpenCode's shell environment and routes non-local provider requests through the proxy while retaining Copilot's original authorization headers and upstream URL.

In another terminal, inspect the proxy:

```bash
headroom doctor
headroom perf
```

If OpenCode cannot load the plugin, rebuild it after pulling changes:

```bash
cd "$HOME/dev-tools/headroom/plugins/opencode"
npm run build
```

## Remove

Remove the absolute `entry.opencode.js` path from the OpenCode `plugin` array, stop the proxy, and restart OpenCode.
