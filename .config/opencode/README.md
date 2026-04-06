# opencode

[opencode](https://opencode.ai) configuration for an AI-assisted development pipeline on Kubuntu, with custom agents, MCP tool servers, and a Bun-runtime cache management plugin.

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

## Sub-documentation

| Component | Description |
|---|---|
| [`custom-tool/cache-ctrl/`](custom-tool/cache-ctrl/README.md) | Bun/TypeScript CLI and opencode plugin for managing AI context caches |
| [`deployable-agents/`](deployable-agents/README.md) | Self-contained agent bundles (ask / implementer / planner) for the opencode pipeline |
