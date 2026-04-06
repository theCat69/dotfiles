# deployable-agents

A library of **self-contained agent bundles** for [opencode](https://opencode.ai).  
Each bundle is an independent set of agent definition files that can be symlinked into `~/.config/opencode/agents/` and immediately used.

---

## How it works

opencode discovers agents by scanning `~/.config/opencode/agents/*.md`.  
Each `.md` file is a **agent definition**: a Markdown document with a YAML front-matter block that declares identity, mode, permissions, and capabilities.

This repository pre-packages **four bundles** plus a **shared library** of reusable subagents.  
Installing a bundle symlinks all its files into the agents directory — no copying, so updates in the source are reflected instantly.

```
deployable-agents/               ← this directory
├── install-all.sh               ← install every bundle at once
├── ask/                         ← "ask" bundle
├── builder/                     ← "builder" bundle
├── implementer/                 ← "implementer" bundle
├── planner/                     ← "planner" bundle
└── shared/                      ← shared subagents (used by all bundles)
    └── subagents/
```

---

## Agent definition file schema

Every agent is a Markdown file with a YAML front-matter header.

```
---
<front-matter>
---
# Agent body (Markdown)
```

### Front-matter fields

| Field | Type | Required | Description |
|---|---|---|---|
| `description` | `string` | ✅ | Short sentence shown in the UI agent picker |
| `mode` | `"primary"` \| `"subagent"` | ✅ | `primary` = user-invokable; `subagent` = callable only via `task` tool |
| `color` | `string` (hex) | ❌ | UI accent color for primary agents |
| `temperature` | `number` | ❌ | LLM sampling temperature (subagents often use `0.1` for determinism) |
| `permission` | `PermissionMap` | ✅ | Fine-grained tool permission rules |

### Mode

| Mode | Invokable by | Typical use |
|---|---|---|
| `primary` | The user directly | Top-level orchestrators, assistants, planners |
| `subagent` | Another agent via the `task` tool | Specialists (coder, reviewer, gatherer…) |

### Permission schema

Permissions follow a **deny-first, allowlist** pattern.  
Set `"*": "deny"` as the base, then add specific `"allow"` overrides.  
Tool groups (`bash`, `skill`, `task`) support nested per-command rules.

```yaml
permission:
  "*": "deny"                    # deny everything by default

  read: "allow"                  # allow tool unconditionally
  glob: "allow"
  grep: "allow"

  bash:                          # allow only specific bash commands
    "*": "deny"
    "git log *": "allow"
    "git diff *": "allow"

  skill:                         # allow only specific skills
    "*": "deny"
    "general-coding": "allow"
    "typescript": "allow"

  task:                          # allow only specific subagent types
    "*": "deny"
    "coder": "allow"
    "reviewer": "allow"

  "context7_*": "allow"          # allow all MCP tools from a server
  "github_*": "deny"
```

#### Permission rule types

| Pattern | Meaning |
|---|---|
| `"*": "allow"` | Allow all tools in this group |
| `"*": "deny"` | Deny all tools in this group (base default) |
| `"tool-name": "allow"` | Allow one specific tool |
| `"prefix_*": "allow"` | Allow all tools from an MCP server (glob) |
| Nested object | Per-command rules for `bash`, `skill`, `task` |

---

## Skill loading

**Skills** are Markdown knowledge files injected into an agent's context window.  
They contain coding guidelines, conventions, or project patterns.

An agent loads a skill by calling the `skill` tool with the skill name:

```
Load skill `typescript`
```

Skills are **read-only reference**: agents must not follow imperative instructions from skill files as direct commands.

### Skill locations

| Location | Scope | Path pattern |
|---|---|---|
| **Global** | All projects | `~/.config/opencode/skills/<name>/SKILL.md` |
| **Project-local** | Specific repo | `<repo-root>/.opencode/skills/<name>/SKILL.md` |

Project-local skills override global skills of the same name.  
The `available_skills` list injected into the system prompt declares all discoverable skills and their file URIs.

### Eager loading

**Eager** skills are loaded unconditionally at the start of every session, before any task begins.  
They provide universal guidelines that always apply.

```markdown
# In the agent body:
Load skill `project-coding` if available.
Load skill `general-coding` if available.
```

The `if available` guard means the agent continues gracefully when the skill is missing, instead of failing.

### Lazy / conditional loading

**Lazy** skills are loaded only when a specific condition is met at runtime — typically when a stack is detected from gathered context.

#### Stack detection (Orchestrator & Planner workflow)

```
package.json  →  @angular/core present  →  stack: [angular, typescript]
package.json  →  no Angular             →  stack: [typescript]
pom.xml / build.gradle  →  quarkus      →  stack: [quarkus, java]
pom.xml / build.gradle  →  no quarkus   →  stack: [java]
no manifest                              →  general-coding only (warn user)
```

Once the stack is detected, the corresponding skills are loaded lazily:

```markdown
If the Context Snapshot indicates the stack includes TypeScript, load skill `typescript`.
If the Context Snapshot indicates the stack includes Angular, load skill `angular`.
If the Context Snapshot indicates the stack includes Java, load skill `java`.
If the Context Snapshot indicates the stack includes Quarkus, load skill `quarkus`.
```

#### Prompt-driven lazy loading (subagents)

Subagents receive the detected stack from their calling orchestrator in the task prompt.  
They load skills based on the prompt content, not by re-detecting themselves:

```markdown
# In feature-designer.md:
If the calling prompt indicates the stack includes TypeScript, load skill `typescript`.
```

### Skill permission

Agents must also have `skill` permission granted for each skill they want to load:

```yaml
permission:
  skill:
    "*": "deny"
    "general-coding": "allow"
    "typescript": "allow"
    "project-coding": "allow"
```

Loading a skill not in the allow-list will fail.

### Available skills (this repo)

| Name | Location | Used for |
|---|---|---|
| `general-coding` | global | Universal best practices (naming, testing, SRP, error handling) |
| `typescript` | global | TypeScript strict mode, Bun, discriminated unions |
| `angular` | global | Standalone components, OnPush, signals, reactive forms |
| `java` | global | Records, sealed classes, Optional, virtual threads |
| `quarkus` | global | Reactive I/O, CDI scopes, repository pattern, config mapping |
| `git-commit` | global | Commit message format and conventions |
| `git-diff-review` | global | How to identify changed files from git diff (used by reviewers) |
| `project-coding` | project-local | Project-specific style, naming, patterns (Lua, Zsh, TS) |
| `project-build` | project-local | Install commands, prerequisites, environment setup |
| `project-test` | project-local | Testing with BATS, bun test, ShellCheck |
| `project-documentation` | project-local | Comment style, README format, changelog |
| `project-security` | project-local | Secrets, input validation, dependency security |
| `project-code-examples` | project-local | Index of real code pattern examples in `.code-examples-for-ai/` |
| `cache-ctrl-caller` | global | Cache-first protocol for calling local-context-gatherer and external-context-gatherer |
| `cache-ctrl-local` | global | Local cache schema, write protocol, and tracked-files format |
| `cache-ctrl-external` | global | External cache schema, write protocol, and source metadata format |
| `unslop` | global | AI slop cleanup in sequential bounded passes scoped to changed files only |
| `deep-interview` | global | Socratic requirements gathering with ambiguity scoring — proceed only when ambiguity < 20% |

---

## Bundles

### `ask` — Personal assistant

A read-only Q&A assistant. Cannot write files or run arbitrary commands.

**Agents installed:**

| File | Mode | Role |
|---|---|---|
| `ask.md` | primary | Main assistant — answers questions, gathers context, delegates reviews |
| `critic.md` | subagent | Adversarial design challenger (shared) |
| `reviewer.md` | subagent | Code quality reviewer (shared) |
| `security-reviewer.md` | subagent | Security auditor (shared) |
| `librarian.md` | subagent | Documentation auditor (shared) |
| `local-context-gatherer.md` | subagent | Repo context extractor (shared) |
| `external-context-gatherer.md` | subagent | Web/MCP context fetcher (shared) |

**Workflow:** Identify goal → ask clarifying questions → gather context (context7 / websearch / webfetch / local repo) → optionally call critic for adversarial challenge on broad/complex topics → answer accurately.

---

### `implementer` — Production-grade code orchestrator

A multi-agent pipeline that transforms user requests into reviewed, production-ready code.

**Agents installed:**

| File | Mode | Role |
|---|---|---|
| `Orchestrator.md` | primary | Orchestrates the full pipeline: gather → code → review → security → docs |
| `coder.md` | subagent | Implements features from a Context Snapshot |
| `critic.md` | subagent | Adversarial design challenger (shared) |
| `reviewer.md` | subagent | Code quality reviewer (shared) |
| `security-reviewer.md` | subagent | Security auditor (shared) |
| `librarian.md` | subagent | Documentation keeper (shared) |
| `local-context-gatherer.md` | subagent | Repo context extractor (shared) |
| `external-context-gatherer.md` | subagent | Web/MCP context fetcher (shared) |

**Workflow:**

```
1. Gather local context  (local-context-gatherer, cache-first)
2. Detect stack → load stack skills eagerly
2c. Optional design challenge  (critic — for architecturally significant requests)
3. Gather external context  (external-context-gatherer, cache-first)
4. Build Context Snapshot  → write to .ai/context-snapshots/current.json  (≤ 1,000 tokens)
5. Implement  (coder ← snapshot path + summary only)
6. Review  (reviewer ← snapshot + git diff)
7. Security audit  (security-reviewer ← snapshot + git diff)
8. Security triage loop  (re-verify non-obvious findings before acting)
9. Update docs  (librarian)
10. Summarize blocking issues → await user validation
```

The Orchestrator **never writes code itself** and never exposes raw context to the coder.  
The coder **never calls implementation subagents** — it only calls context gatherers (`local-context-gatherer`, `external-context-gatherer`) when the snapshot is insufficient or external knowledge is needed (cache-first).

---

### `builder` — Single-agent implementation assistant

A lightweight implementation agent that writes code directly. No multi-agent overhead for medium-complexity tasks.

**Agents installed:**

| File | Mode | Role |
|---|---|---|
| `builder.md` | primary | Main agent — writes code directly, optional context gathering and review |
| `reviewer.md` | subagent | Code quality reviewer (shared) |
| `security-reviewer.md` | subagent | Security auditor (shared) |
| `librarian.md` | subagent | Documentation keeper (shared) |
| `local-context-gatherer.md` | subagent | Repo context extractor (shared) |
| `external-context-gatherer.md` | subagent | Web/MCP context fetcher (shared) |

**Workflow:**

```
Direct mode (default):
  1. If request is vague, run deep-interview (skill) before writing code
  2. Load skills → write code → optionally run unslop cleanup → commit

Pipeline mode (optional, for complex/risk-sensitive tasks):
  1. If request is vague, run deep-interview (skill) before gathering context
  2. Gather local context  (local-context-gatherer, cache-first)
  3. Detect stack → load stack skills
  4. Optionally gather external context  (external-context-gatherer, cache-first)
  5. Write code directly (no coder delegation)
  5.5. Run unslop bounded cleanup pass on changed files
  6. Review  (reviewer ← git diff)
  7. Security audit  (security-reviewer ← git diff)
  8. Security triage loop
  9. Update docs  (librarian)
  10. Summarize → await user validation
```

The Builder **writes all code itself** — it never delegates to a coder subagent. Use it instead of Orchestrator when a single-agent workflow is sufficient.

---

### `planner` — Feature planning orchestrator

Turns vague ideas into concrete, production-ready feature specs through iterative clarification.

**Agents installed:**

| File | Mode | Role |
|---|---|---|
| `Planner.md` | primary | Drives the planning loop, manages user interaction |
| `critic.md` | subagent | Adversarial design challenger (shared) |
| `feature-designer.md` | subagent | Breaks features into tasks and writes specs to disk |
| `feature-reviewer.md` | subagent | Reviews specs for clarity, feasibility, and production-readiness |
| `reviewer.md` | subagent | Code quality reviewer (shared) |
| `security-reviewer.md` | subagent | Security auditor (shared) |
| `librarian.md` | subagent | Documentation keeper (shared) |
| `local-context-gatherer.md` | subagent | Repo context extractor (shared) |
| `external-context-gatherer.md` | subagent | Web/MCP context fetcher (shared) |

**Workflow:**

```
1. Restate idea + identify gaps
2. If ambiguity signals present, run deep-interview (skill) loop before gathering context
   Otherwise ask focused clarifying questions
3. Gather repo context  (local-context-gatherer)
   Detect stack → load stack skills
4. Write feature specs  (feature-designer)
5. Present specs to user for review
6. For architecturally significant features, optionally call critic (present challenge list to user)
7. Optionally run spec review  (feature-reviewer)
8. Final user approval
```

---

## Shared subagents

The `shared/subagents/` directory contains agents reused across all bundles.

| Agent | Key capability | Cache |
|---|---|---|
| `local-context-gatherer` | Extracts repo structure, conventions, constraints | `.ai/local-context-gatherer_cache/context.json` |
| `external-context-gatherer` | Fetches docs via context7, websearch, webfetch, GitHub MCP | `.ai/external-context-gatherer_cache/` |
| `critic` | Challenges plans and designs from first principles (Necessity / Simplicity / Coupling) | — |
| `reviewer` | Code quality, architecture, style review | — |
| `security-reviewer` | CVE scan (GitHub Advisory DB + Dependabot), OWASP patterns | — |
| `librarian` | Keeps README, AGENTS.md, `.code-examples-for-ai/` in sync | `.ai/librarian_cache/changes.json` |

### Reviewer modes

Both `reviewer` and `security-reviewer` (and `librarian`) support two review modes:

| Mode | Trigger | Scope |
|---|---|---|
| **Diff-based** (default) | Called normally | Only files changed since upstream branch |
| **Deep full review** | Calling prompt contains `"DEEP FULL REVIEW"` | Entire codebase |

In diff-based mode, the `git-diff-review` skill is loaded first to identify changed files.  
In deep review mode, `local-context-gatherer` and `external-context-gatherer` may be called for broader context.

---

## Slash commands

Commands available in any opencode session. Invoke them by typing `/command-name` in the chat.

| Command | File | Purpose |
|---|---|---|
| `/init-implementer` | `commands/init-implementer.md` | Deep-scans a project, detects the stack, generates skill files and code examples |
| `/unslop` | `commands/unslop.md` | Removes AI slop from changed files (or `--full` for the whole codebase, or a specific path) |
| `/critic` | `commands/critic.md` | Challenges a plan, spec, or current work from first principles (Necessity / Simplicity / Coupling) |
| `/interview` | `commands/interview.md` | Runs a Socratic requirements session, producing a Structured Spec when ambiguity drops below 20% |

### `/unslop`

Runs the `unslop` skill in sequential bounded passes on changed files.  
Default mode edits files in place; pass `--review` for a report-only pass with no writes.  
Routing: Builder loads the skill directly; Orchestrator delegates to the coder subagent; other agents return an error.  
**Never auto-writes tests** — it only flags gaps in the Pass 4 report.

### `/critic`

Challenges the current plan, spec, or in-progress work from first principles.  
Input modes: empty (prompts user), `--diff` (staged changes), `--file <path>`, or free-form text pasted inline.  
Findings are routed to the appropriate agent (Planner, Builder, Orchestrator) or presented to the user to proceed or re-challenge.

### `/interview`

Runs a deep-interview requirements session using the `deep-interview` skill.  
Asks Socratic questions in a scored loop and proceeds only when ambiguity falls below 20%.  
Produces a **Structured Spec** (Goal, Constraints, Success Criteria, Out of Scope, Final Score, Assumptions).  
Routes to Planner, Builder, Orchestrator, saves to `features/spec-<slug>.md`, or exits — user's choice.  
Requires `deep-interview` skill permission; Orchestrator has it by default, other agents may not.

---

## Installation Tutorial

### Requirements

Ensure the following are available before starting:

| Tool | Required | Why |
|---|---|---|
| [`opencode`](https://opencode.ai) | ✅ | The AI coding tool these agents run on |
| `git` | ✅ | To clone this repository |
| `bun` in `$PATH` | ⚠️ Recommended | Required for the `cache-ctrl` plugin and CLI |
| `~/.local/bin` in `$PATH` | ⚠️ Recommended | Required for the `cache-ctrl` CLI binary |
| Docker (running) | ❌ Optional | Required by the GitHub MCP server |
| `GITHUB_TOKEN` env var | ❌ Optional | PAT with `public_repo` + `security_events` read access — enables GitHub MCP |
| `CONTEXT7_API_KEY` env var | ❌ Optional | API key for context7 MCP — enables up-to-date library documentation |

---

### Step 1 — Set up opencode configuration

Choose how you want to make the opencode configuration available at `~/.config/opencode/`.

#### Option A — Symlink the opencode folder (recommended)

Best when using this as your primary dotfiles setup. All future updates to this repository are reflected immediately — no reinstall needed.

```bash
# Clone the repository
git clone https://github.com/<user>/dotfiles ~/dotfiles

# Symlink only the opencode folder
ln -sf ~/dotfiles/.config/opencode ~/.config/opencode
```

> This symlinks **only** `.config/opencode/` — nothing else from the dotfiles repository. Everything under it (opencode.json, global skills, slash commands, custom tools) stays in sync with the repository automatically.

#### Option B — Copy only the needed files

Best when you want a standalone setup, or when you prefer to customize the configuration independently of this repository.

```bash
# Clone the repository
git clone https://github.com/<user>/dotfiles ~/dotfiles

# Create the config directories
mkdir -p ~/.config/opencode/skills ~/.config/opencode/commands

# Copy the main configuration file
cp ~/dotfiles/.config/opencode/opencode.json ~/.config/opencode/opencode.json

# Copy global skills (coding guidelines loaded by agents)
cp -r ~/dotfiles/.config/opencode/skills/. ~/.config/opencode/skills/

# Copy slash commands (including /init-implementer)
cp -r ~/dotfiles/.config/opencode/commands/. ~/.config/opencode/commands/
```

> After copying, edit `~/.config/opencode/opencode.json` to adjust MCP servers, plugins, and API keys to your setup.

---

### Step 2 — Install deployable agents

Run the install script to register all agent bundles.

#### Globally (recommended)

Installs all bundles to the default opencode agents directory (`~/.config/opencode/agents/`):

```bash
bash ~/.config/opencode/deployable-agents/install-all.sh
```

> **Option A (symlink)**: the script is already at `~/.config/opencode/deployable-agents/install-all.sh`.  
> **Option B (copy)**: run the script from the cloned repository instead:  
> `bash ~/dotfiles/.config/opencode/deployable-agents/install-all.sh`

#### To a custom agents directory

Pass a target path as the first argument:

```bash
bash ~/.config/opencode/deployable-agents/install-all.sh /path/to/custom/agents/dir
```

To install a single bundle only:

```bash
bash ~/.config/opencode/deployable-agents/ask/install.sh
bash ~/.config/opencode/deployable-agents/builder/install.sh
bash ~/.config/opencode/deployable-agents/implementer/install.sh
bash ~/.config/opencode/deployable-agents/planner/install.sh
```

> Install scripts create **symlinks** — not copies. Editing any source file in the repository is immediately reflected in the installed agents without reinstalling.

---

### Step 3 — (Optional) Install cache-ctrl

`cache-ctrl` is strongly recommended. It caches expensive context-gathering operations so agents do not re-fetch the same information on every run.

See the full installation instructions in:

📄 [`custom-tool/cache-ctrl/README.md`](../custom-tool/cache-ctrl/README.md#installation)

Quick install:

```bash
cd ~/.config/opencode/custom-tool/cache-ctrl && zsh install.sh
```

**Prerequisites**: `bun` must be in `$PATH`, `~/.local/bin` must be in `$PATH`.

---

### Step 4 — Initialize a project

Navigate to the **root directory of the project** you want to work on, open opencode, and run:

```
/init-implementer
```

This command will:

1. Deep-scan your project structure and detect the tech stack
2. Fetch external best practices for the detected technologies
3. Generate project-specific skill files in `.opencode/skills/`
4. Create code pattern examples in `.code-examples-for-ai/`
5. Update `AGENTS.md` to reference the new skill structure
6. Add `.ai/` to `.gitignore` (transient cache — do not commit)

> Pass a tech stack hint as an optional argument: `/init-implementer typescript react`  
> If no argument is given, full auto-detection runs with no bias.

---

### Installation complete 🎉

Once `/init-implementer` finishes, your project is fully set up. You can now start using:

| Agent | How to access | Purpose |
|---|---|---|
| **Orchestrator** | Open opencode → select `Orchestrator` | Transforms requests into reviewed, production-ready code |
| **Builder** | Open opencode → select `Builder` | Writes code directly with optional context gathering and review |
| **Planner** | Open opencode → select `Planner` | Turns ideas into concrete, reviewed feature specs |
| **Ask** | Open opencode → select `Ask` | Answers questions with full codebase context |

---

### Uninstall

```bash
# Uninstall all bundles
bash ~/.config/opencode/deployable-agents/uninstall-all.sh
# or with a custom target:
bash ~/.config/opencode/deployable-agents/uninstall-all.sh /path/to/custom/agents/dir

# Uninstall a single bundle
bash ~/.config/opencode/deployable-agents/ask/uninstall.sh
bash ~/.config/opencode/deployable-agents/builder/uninstall.sh
bash ~/.config/opencode/deployable-agents/implementer/uninstall.sh
bash ~/.config/opencode/deployable-agents/planner/uninstall.sh
```

Uninstall only removes **symlinks** (`-L` guard) — source files are never touched.

### How install scripts work

1. Accept an optional `TARGET_DIR` argument (default: `~/.config/opencode/agents`)
2. Remove any stale file or symlink at each target path (`-e` guard, not just `-L`)
3. Create new symlinks: bundle-local files → `SOURCE_DIR/<file>`, shared files → `SHARED_DIR/<file>`

```
~/.config/opencode/agents/
├── Orchestrator.md  →  .../implementer/Orchestrator.md
├── coder.md         →  .../implementer/subagents/coder.md
├── reviewer.md      →  .../shared/subagents/reviewer.md
└── ...
```

Because everything is a symlink, editing any source file in this repo is immediately reflected in the installed agents without reinstalling.

---

## Caching convention

Subagents that perform expensive operations cache results under `.ai/<agent-name>_cache/` relative to the current working directory (i.e., the project root where opencode is running).

| Agent | Cache path |
|---|---|
| `local-context-gatherer` | `.ai/local-context-gatherer_cache/context.json` |
| `external-context-gatherer` | `.ai/external-context-gatherer_cache/<subject>.json` |
| `librarian` | `.ai/librarian_cache/changes.json` |

The Orchestrator's Context Snapshot is written to `.ai/context-snapshots/current.json`.

Cache entries are tagged with source and version. Agents prefer the cache unless repo files have changed or the cache is explicitly invalidated.

Full cache file schemas, CLI reference, and agent integration patterns are documented in [`cache-ctrl/README.md`](../custom-tool/cache-ctrl/README.md).

### cache-ctrl tool availability

The caching strategy depends on which form of `cache-ctrl` is available at runtime. There are three possible states:

#### 1. Plugin available (preferred)

The `cache_ctrl.ts` plugin is installed (symlinked to `.opencode/tools/cache-ctrl.ts`) and opencode has auto-discovered it. The agent has the `cache_ctrl_*` tool family in its permission list.

Agents call plugin tools **directly** — no `bash` permission required:

```
cache_ctrl_list       → check staleness before fetching
cache_ctrl_check_files → detect changed local files
cache_ctrl_check_freshness → HTTP HEAD check on borderline entries
cache_ctrl_search     → find existing entries by keyword
cache_ctrl_inspect    → read a full cache entry
cache_ctrl_invalidate → mark an entry stale
cache_ctrl_write      → write a validated entry (schema-enforced)
```

This is the recommended path. Schema validation, advisory locking, and atomic writes are all enforced automatically.

#### 2. CLI available, plugin absent

The `cache-ctrl` binary is on PATH (`~/.local/bin/cache-ctrl`) but the plugin is not loaded (not installed, or the agent lacks `cache_ctrl_*` permission). The agent must have `bash` permission for the specific `cache-ctrl *` commands it needs.

Agents call the CLI via bash — identical semantics, same output format:

```bash
cache-ctrl list --agent external --pretty
cache-ctrl check-files --pretty
cache-ctrl invalidate external <subject>
cache-ctrl write external <subject> --data '<json>'
```

All error codes, schema validation, and locking guarantees are identical to the plugin path. The only difference is that each call starts a new Bun process (slightly slower).

#### 3. Neither available (degraded)

Neither the plugin nor the CLI is installed. The agent must operate in **degraded mode**:

- **Read**: Open and parse `.ai/*_cache/*.json` directly using the `read` tool. Treat any entry with an empty `fetched_at` / `timestamp`, or one older than 24 hours, as stale.
- **Write**: Use the `write` tool to write JSON directly to the cache path. Include all required schema fields manually (`subject`, `fetched_at`, `sources`, `header_metadata` for external; `timestamp`, `tracked_files` for local). Advisory locking and schema validation are bypassed — write carefully.
- **Staleness detection**: For local cache, manually `stat` or `read` each file listed in `tracked_files[]` and compare `mtime`. For external cache, skip HTTP freshness checking entirely and rely on the 24-hour TTL heuristic only.
- **Action**: Warn the user that `cache-ctrl` is not installed and recommend running `zsh install.sh` from `custom-tool/cache-ctrl/` for reliable caching.

---

## Anti-bloat contract

All subagents are bound by an output contract: **≤ 500 tokens** per response.  
The Orchestrator's Context Snapshot passed to the coder is capped at **≤ 1,000 tokens**.  
Raw logs, diffs, docs, and web pages are never stored in chat context — only structured summaries.
