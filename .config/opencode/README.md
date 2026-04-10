# opencode

[opencode](https://opencode.ai) configuration for an AI-assisted development pipeline on Kubuntu, with external agent/skill packages, MCP tool servers, and cache management integration.

## External Packages

### `la-briguade` opencode plugin

Provides the production-grade multi-agent setup used by this repo (agents, skills, slash commands, hooks).

- Repository: <https://github.com/theCat69/la-briguade>
- Install: `npm install la-briguade && npx la-briguade install`
- Uninstall: `npx la-briguade uninstall`

### `@thecat69/cache-ctrl`

Provides the cache-control CLI and native OpenCode integration used by agents.

- Repository: <https://github.com/theCat69/cache-ctrl>
- Install CLI: `npm install -g @thecat69/cache-ctrl`
- Setup in opencode config: `cache-ctrl install`

```bash
npm install -g @thecat69/cache-ctrl && cache-ctrl install
```

## Plugins

- **@slkiser/opencode-quota** — real-time token usage tracking
- **@mohak34/opencode-notifier** — desktop notifications on task completion

## MCP Servers

| Server | Purpose |
|---|---|
| `context7` | Up-to-date library documentation fetched from the web |
| `youtube-transcript` | Fetch YouTube video transcripts as context |
| `github` | Read-only GitHub access (repos, security advisories, Actions) |

MCP tools are denied by default and only enabled for the `build` and `plan` agents via per-agent permission overrides in `opencode.json`.

## Custom LSP

`jdtls-lombok` — Java language server with Lombok annotation processing pre-wired (`-javaagent:~/dev-tools/jars/lombok.jar`). Replaces the default `jdtls` entry.

## Installed Artifacts (Auto-managed)

The following paths are installed/updated by external package installers and should not be manually edited:

- `plugins/index.js` — installed by `npx la-briguade install`
- `tools/cache_ctrl.ts` — installed by `cache-ctrl install`
- `skills/cache-ctrl-*/` — installed by `cache-ctrl install`

## Sub-documentation

| Component | Description |
|---|---|
| [`la-briguade` (external)](https://github.com/theCat69/la-briguade) | opencode plugin providing agents, skills, slash commands, and hooks |
| [`@thecat69/cache-ctrl` (external)](https://github.com/theCat69/cache-ctrl) | cache-control CLI + OpenCode integration for cache inspection and freshness workflows |
| [`deployable-agents/`](deployable-agents/README.md) | Self-contained agent bundles (ask / implementer / planner) for the opencode pipeline |
