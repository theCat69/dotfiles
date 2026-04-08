# Ideas from oh-my-openagent

Analysis of [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) (omo) compared to this system.
Recorded 2026-04-08. omo version at time of analysis: v3.15.3 (~49K stars, ~214K LOC TypeScript).

---

## What this system has that omo doesn't

| Feature | Where | Why it matters |
|---|---|---|
| **`cache-ctrl` plugin** — schema-validated, hash-based, atomic context cache | `custom-tool/cache-ctrl/` | omo has session checkpoints but no typed, validated cache with staleness detection |
| **Context Snapshot pattern** — Orchestrator writes ≤ 1,000-token snapshot to disk, passes path only to coder | `agents/Orchestrator.md` | Prevents context bloat; coder never sees raw context |
| **Deny-first permission system** — `"*": "deny"` base + per-command bash rules + per-skill rules per agent | All agent `.md` files | More granular than omo's per-agent permissions |
| **Deployable agent bundles** — installable via symlinks, selective (ask / builder / implementer / planner) | `deployable-agents/` | omo is a global install; no bundle concept |
| **Security triage loop** — Confirmed / Deferred / Discarded classification per finding | `agents/Orchestrator.md` step 8 | omo handles security inline without this structured loop |
| **`/full-review` command** — 7-step codebase-wide review with false-positive triage | `commands/full-review.md` | No equivalent in omo |
| **Azure DevOps MCP** | `opencode.json` | omo has no Azure DevOps support |
| **Custom Java LSP (jdtls-lombok)** | `opencode.json` | omo has no custom LSP configuration |
| **Feature planning pipeline** — Planner → feature-designer → feature-reviewer as a standalone pre-implementation pipeline | `agents/Planner.md` | omo's Prometheus bundles planning with execution |

---

## What omo has that this system doesn't

### 1. Autonomous execution loop (`ulw` / `ralph-loop`)

omo's **ultrawork (`ulw`)** mode runs a full autonomous loop: explore → implement → verify → fix → loop until 100% done. You type it and walk away. The **Ralph Loop** is a self-referential continuation enforcer that keeps agents on task.

This system has `/unslop-loop` (bounded, cleanup-only) but nothing that drives a full feature from gather to verified completion autonomously.

---

### 2. Cross-session continuity (`boulder.json`)

omo tracks the active plan + all session IDs in `.sisyphus/boulder.json`. After a crash or logout, `/start-work` resumes exactly where it left off.

This system has no cross-session state. If opencode crashes mid-Orchestrator run, all in-flight state is lost.

---

### 3. Category system — work-type-based model routing

omo lets you call `task(category: "visual-engineering")` and the harness picks the best model for that work type:

| Category | Default model | Use |
|---|---|---|
| `visual-engineering` | Gemini 3.1 Pro | Frontend, UI/UX, animation |
| `ultrabrain` | GPT-5.4 xhigh | Deep logic, complex architecture |
| `deep` | GPT-5.4 medium | Autonomous research |
| `quick` | GPT-5.4-mini | Trivial tasks, typo fixes |
| `writing` | Gemini 3 Flash | Docs, prose |
| `unspecified-high` | Claude Opus 4.6 max | General high-effort |
| `unspecified-low` | Claude Sonnet 4.6 | General low-effort |

This system routes to named agents only — all agents use the default model.

---

### 4. Wisdom accumulation notepad (`.sisyphus/notepads/`)

omo maintains per-plan notepads at `.sisyphus/notepads/{plan-name}/` with `learnings.md`, `decisions.md`, `issues.md`, `verification.md`, `problems.md`. These are passed forward to every subsequent subagent in the plan — wisdom from one task informs the next.

This system has no equivalent forwarding of learnings between sessions or tasks.

---

### 5. Hashline edit tool

omo anchors every edit with a **LINE#ID content hash**. If the file changed between the agent reading it and editing it, the hash no longer matches and the edit is rejected rather than applied to the wrong line. This increased edit success rate from 6.7% → 68.3% on fast models.

This system uses the standard `edit` tool — stale-line errors can silently corrupt files during rapid iteration on large files.

*Note: this is a harness-level feature. It cannot be replicated without building or adopting omo's harness.*

---

### 6. `grep_app` MCP — GitHub code search

omo includes `grep_app`, a built-in MCP that searches GitHub code at scale. Useful for finding real-world usage examples of APIs and libraries during `external-context-gatherer` runs.

This system has no equivalent code-search MCP.

---

### 7. Skill-embedded MCPs (on-demand MCP spin-up)

omo can embed MCP server configurations inside skill files. The MCP spins up only when the skill is loaded, keeping context clean and scoping tools precisely to the task. This system's MCPs are always declared at the global level — permission-gated but always running.

---

### 8. Multimodal agent (`Multimodal-Looker`)

omo has a dedicated `Multimodal-Looker` agent with a `look_at` tool for analyzing PDFs, images, wireframes, and diagrams.

This system has no multimodal capability.

---

### 9. Dual-prompt agents — Claude vs GPT auto-switch

omo's `Prometheus` (planner) and `Atlas` (orchestrator) detect at runtime whether they are running on a Claude or GPT model via `isGptModel()` and switch prompt strategies:

- **Claude**: mechanics-driven, detailed checklists, ~1,100 lines
- **GPT**: principle-driven, XML-tagged, ~121 lines, `Decision Complete` concept

This system's agents are all Claude-optimized. They perform significantly worse on GPT models because GPT responds better to principle statements and XML structure than to detailed procedural checklists.

See [section below](#gpt-fallback-prompts) for full explanation.

---

### 10. Blocking architectural rules (`.sisyphus/rules/`)

omo injects BLOCKING TypeScript rules per task via `.sisyphus/rules/modular-code-enforcement.md`:

- `index.ts` = re-exports and factory wiring only — **never** business logic
- `utils.ts` / `helpers.ts` / `service.ts` / `common.ts` banned as top-level catch-alls
- SRP: every `.ts` file has exactly one clear responsibility
- 200 LOC hard limit per file (excluding blank lines, comments, prompt template strings)

These are not guidelines — the harness injects them as blocking constraints into every coder call. They cannot be overridden by other skills.

See [section below](#opencode-rules-vs-skills) for full comparison against this system's skill approach.

---

### 11. `/init-deep` — hierarchical AGENTS.md generation

omo's `/init-deep` recursively generates `AGENTS.md` throughout the entire project tree, not just at the root.

This system's `/init-implementer` only initializes at the project root.

---

### 12. IntentGate classifier

omo classifies user intent before acting: `research / implementation / investigation / fix`. Different intents route to different pipelines automatically.

This system relies on the user selecting the right agent. No automatic intent classification.

---

## Priority ideas to implement

| Priority | Idea | Effort | Value |
|---|---|---|---|
| 🔴 High | **Session checkpoint** — Orchestrator writes `.ai/checkpoint.json` at each step (goal + current step + snapshot path). Add `/resume` command that reads it and restarts. | Low | Survives crashes; enables interrupted session recovery |
| 🔴 High | **Wisdom notepad** — `.ai/session-notes.md` that Orchestrator appends decisions and learnings to at each step, and reads at startup. | Very low | Accumulates context across sessions; improves subsequent runs |
| 🟠 Medium | **`/work-loop` command** — autonomous loop: gather → implement → test → review → fix → loop until reviewer returns zero findings or commit limit reached. | Medium | Walk-away feature implementation |
| 🟠 Medium | **Parallel reviewer + security-reviewer calls** — fire both in one Orchestrator step instead of sequential. | Very low | Faster pipeline for every task |
| 🟠 Medium | **`.opencode/rules/` blocking rules** — short, injected-per-coder-call rules for TypeScript architecture (index.ts, no catch-alls, 200 LOC). See analysis below. | Low | Hardens code quality beyond soft guidelines |
| 🟡 Low | **`grep_app` MCP** — add a GitHub code search MCP to `opencode.json` for real-world API usage examples. | Very low | Better external context gathering |
| 🟡 Low | **GPT-fallback prompts** — add a compact XML-structured variant of Builder and Orchestrator prompts for non-Claude models. See analysis below. | Medium | Multi-model resilience |
| 🟡 Low | **Model tier hints** — annotate subagent `.md` files with a suggested model size (e.g., `reviewer` on Haiku, `coder` on Sonnet/Opus). | Low | Cost optimization without category system overhead |

---

## Deep dives

### `.opencode/rules/` vs the skill system {#opencode-rules-vs-skills}

**Short answer**: rules and skills solve different problems. Skills are guidelines the agent reads and chooses to follow. Rules are constraints the harness injects as blocking context the agent cannot ignore or miss. They are complementary, not substitutes.

**The problem with skills for enforcement**

Your skill system works well for *guidance*. An agent loads `project-coding`, reads the TypeScript conventions, and tries to follow them. But three things can undermine this:

1. **Skills compete for attention.** A coder prompt already contains: the Context Snapshot, the task description, the skill files, and any examples. When context fills up, the model deprioritizes content it read earlier. A 200-line `project-coding` skill is read once at startup and gradually loses influence as the conversation grows.

2. **Skills are opt-in.** The agent loads them during the Startup Sequence — which it can forget, misfire, or skip after compaction. A skill not loaded is a skill with zero enforcement weight.

3. **Skills are read as reference, not as constraints.** "One responsibility per file" in a skill reads as advice. The model weighs it against competing pressures (user urgency, coder convenience, task complexity). In a high-complexity task, it may write a `utils.ts` full of unrelated helpers and still feel it followed the spirit of the guidelines.

**What `.opencode/rules/` adds**

A rules file is injected directly into the coder's task call prompt by the Orchestrator, adjacent to the task itself:

```
> Implement: [task description]
>
> BLOCKING RULES (not negotiable):
> - index.ts = re-exports only. No business logic.
> - utils.ts, helpers.ts, service.ts are banned. Give the file a specific name.
> - 200 LOC per file hard limit.
> - SRP: one file, one responsibility, nameable in one phrase.
```

The rules arrive *at the moment of decision*, not 15 turns ago during startup. They are framed as blocking constraints, not guidelines. They are short enough to never fall off the context window. And crucially, the Orchestrator can conditionally inject them — only for TypeScript projects, only when creating new files, etc.

**What skills do that rules cannot**

Skills carry *reasoning and context*: why a pattern exists, what it looks like, what alternatives were considered, examples from the project. A rule that says "200 LOC limit" is meaningless without the skill that explains SRP, cohesion, and how to split a module correctly. Rules enforce; skills teach.

**The right layering**

```
skills/project-coding/    — teaches patterns, naming, architecture philosophy
.opencode/rules/          — enforces the non-negotiable subset at call time
```

Use skills for: everything the agent needs to understand and reason about.
Use rules for: the 3–5 things that, if violated, produce structural debt that is expensive to undo — and where "I forgot" is not an acceptable answer.

---

### GPT-fallback prompts {#gpt-fallback-prompts}

**What it is**

A GPT-fallback prompt is an alternative version of an agent's instruction body, optimized for GPT-family models (GPT-4o, GPT-5, etc.) rather than Claude. The agent detects which model it is running on at runtime and switches between the Claude prompt and the GPT prompt.

**Why GPT needs different prompts**

Claude and GPT have different *instruction-following styles* shaped by their training:

| Dimension | Claude | GPT |
|---|---|---|
| **Instruction format** | Responds well to numbered steps, checklists, and detailed procedural sequences | Responds better to principles, XML-structured context, and `Decision Complete` patterns |
| **Verbosity** | Tolerates long, detailed prompts (~1,100 lines) without degradation | Long procedural prompts cause GPT to drift, hallucinate steps, or collapse the sequence |
| **Reasoning trigger** | Claude chains reasoning naturally through detailed instructions | GPT needs explicit `<thinking>` blocks or structured problem decomposition |
| **Boundary enforcement** | Claude respects implicit boundaries ("never write code yourself") | GPT benefits from explicit XML boundary tags: `<constraints>`, `<role>`, `<output-format>` |
| **Stop conditions** | Claude tracks state implicitly through the conversation | GPT benefits from explicit terminal state declarations: "When done, output: `Decision Complete`" |

A prompt written for Claude looks like this:

```markdown
# Workflow
1. Restate goal briefly.
2. Call local-context-gatherer (cache-first).
3. Detect stack from gathered context:
   - package.json containing @angular/core → stack: [angular, typescript]
   ...
4. Filter into Context Snapshot (≤ 1,000 tokens) and write to .ai/context-snapshots/current.json.
5. Call coder with snapshot path + summary only.
...
10. Summarize blocking issues and next steps.
```

The same logic written for GPT looks like this:

```xml
<role>You are an orchestrator. You never write code.</role>

<principles>
- Gather context before acting
- Pass snapshots, not raw data
- Every change must be reviewed before shipping
</principles>

<workflow>
Gather → Snapshot → Implement → Review → Verify → Ship
</workflow>

<terminal-state>
Output "Decision Complete" when all steps are done and user has validated.
</terminal-state>
```

**Why this matters for your system**

Right now, all your agents are Claude-optimized. If you ever run them on a GPT model — whether because you switch providers, a specific task needs GPT's reasoning, or you want cost control via GPT-5-mini for lightweight tasks — the prompts will underperform. The Orchestrator's 10-step numbered workflow will cause GPT to mechanically execute steps without understanding the intent. The Builder's checklist will be followed too literally, missing the conditional logic embedded in the prose.

omo solves this by maintaining two prompt bodies per dual-prompt agent and calling `isGptModel()` at startup to pick the right one. You don't need to do this for every agent — only the primary orchestration agents (Orchestrator, Builder) would benefit meaningfully. Subagents (coder, reviewer) are usually short enough that the difference is marginal.

**Is it worth implementing now?**

Only if you actually use GPT models. If you run exclusively on Claude (Anthropic or GitHub Copilot Claude), your current prompts are already well-optimized and adding GPT variants would be pure overhead. Implement this when you have a concrete reason to switch to or mix in GPT.

---

### Multimodal-Looker: is it worth implementing? {#multimodal-looker}

**Where it lives**

- **Agent config**: `src/agents/multimodal-looker.ts` — `createMultimodalLookerAgent(model)` returns an `AgentConfig`
- **Tool**: `src/tools/look-at/tools.ts` — `createLookAt(ctx)` returns the `look_at` `ToolDefinition`
- **Model resolution**: `multimodal-agent-metadata.ts` — `resolveMultimodalLookerAgentMetadata(ctx)` (registered model first → dynamic fallback from vision-capable model cache)
- **Fallback chain builder**: `multimodal-fallback-chain.ts` — merges `visionCapableModelsCache` with hardcoded fallback chain (`gpt-5.4 medium → kimi-k2.5 → glm-4.6v → gpt-5-nano`)
- Public surface: the `look_at` tool. The agent itself is never called directly.

**What it actually does**

1. Accepts `file_path` (disk file) or `image_data` (base64 clipboard) + `goal`
2. Converts unsupported image formats (BMP, TIFF, etc.) to JPEG before sending
3. Resolves a vision-capable model via `resolveMultimodalLookerAgentMetadata`
4. Creates a new child opencode session inheriting the parent's directory
5. Sends the file as a **multimodal attachment** (`type: "file"`, `mime`, `url`) — NOT via the Read tool
6. The Multimodal-Looker agent runs with `read: false`, `task: false`, `call_omo_agent: false`, `look_at: false` — completely locked down
7. Polls for the assistant's response text and returns it to the caller
8. The main agent never touches the raw file — only sees the extracted summary

**The real innovation: tool-call interface to vision**

This is not about the vision capability itself — Claude Sonnet 4.6 already supports vision natively. The genuine innovation is the **agentic tool interface**: a coder or reviewer agent can call `look_at(file: "design.pdf", goal: "list all API endpoints on page 3")` autonomously, mid-task, without breaking its own context or requiring user intervention. The file is analyzed, the extract is returned, and the main agent continues.

**Is there a real benefit?**

Depends entirely on your workload:

| If you work on... | Verdict |
|---|---|
| **Dotfiles, shell scripts, Lua, TypeScript** (your current system) | ❌ No benefit. Zero visual assets in the codebase. |
| **Frontend, design systems, UI components** | ✅ High value. Analyze wireframes, screenshots, design tokens. |
| **Document-heavy work (PDFs, specs, RFCs)** | ✅ High value. Extract sections, tables, structure without flooding context. |
| **Architecture diagrams, system designs** | ✅ Medium value. Explain relationships and flows to feed planning agents. |

**The model routing complexity**

The fallback chain logic in `multimodal-fallback-chain.ts` is sophisticated:
1. Check if you have a registered Multimodal-Looker agent config with an explicit model
2. If yes, check if that model is in the `visionCapableModelsCache`
3. If the registered model is NOT vision-capable, use it anyway (trusts explicit human config over the cache)
4. If no registered model, dynamically pick the best available vision-capable model from connected providers

This means `look_at` works across different provider setups automatically — it doesn't require GPT specifically. On this system (Claude via GitHub Copilot), Claude Sonnet 4.6 would be selected, since it is already vision-capable.

**Can you replicate this without omo's harness?**

Partially. The pieces you would need:
- A `look_at` tool that spawns a subagent via `task()` with the file path and goal in the prompt
- The subagent returns ONLY the extract, no preamble

What you cannot replicate without omo:
- The multimodal **attachment** mechanism (sending a file as `type: "file"` in prompt parts) — this is a harness-level feature not currently exposed as a standard opencode tool
- The MIME detection and JPEG conversion pipeline
- The dynamic `visionCapableModelsCache` resolution

**Recommendation for this system**

Skip it. Your workload is entirely text-based (Lua, Zsh, TypeScript, shell). If you ever move into frontend work or begin analyzing design documents during agent tasks, the concept is worth revisiting. The lightweight equivalent — passing a file path to a Claude subagent and asking for an extract as a `task()` call — would cover 80% of the use case without any harness-level infrastructure.
