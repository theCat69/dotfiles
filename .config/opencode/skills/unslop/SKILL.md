---
name: unslop
description: Clean AI-generated code slop in sequential bounded passes scoped to changed files only
---

# Unslop — AI Slop Cleanup

**Philosophy**: slop cleanup is a scalpel, not a rewrite. The invariant is behavior preservation. Lock behavior with tests before removing anything that has side effects. Prefer deletion over addition — every line of code is a liability. Diffs must be small and reversible. Scope is always bounded to changed files only, never the whole codebase.

---

## Slop Categories

Five categories the agent must scan for in every changed file:

1. **Dead code** — unreachable branches, unused exports/vars/functions, stale feature flags, commented-out blocks, debug leftovers (`console.log`, `print`, `debugger`, `TODO`-that-shipped).

2. **Duplication** — copy-paste logic, near-identical functions whose only difference is a constant, repeated config blocks, redundant helper utilities that do the same thing under different names.

3. **Needless abstraction** — pass-through wrappers with no logic, single-use layers whose only job is to call one other thing, speculative indirection ("we might need this later"), premature generalization of code that only has one call site.

4. **Boundary violations** — hidden coupling between modules that should not know about each other, misplaced responsibilities (business logic in a view, I/O in a pure function), logic leaking across architectural layers.

5. **Weak test coverage** — behavior not locked by any test, assertions that only check "no error thrown" without verifying the actual result, missing edge cases on code paths touched in cleanup passes.

---

## Workflow — Sequential Passes

Passes run ONE AT A TIME — never batched. Complete each pass fully before starting the next.

**Pass 1 — Dead code**
Delete unreachable branches, unused variables and functions, stale feature flags, commented-out code blocks, and debug leftovers. Do NOT touch code that is merely "not called yet" if there is evidence it is intentionally scaffolded (e.g. an exported symbol with a docstring, a stub with a TODO explaining upcoming use).

**Pass 2 — Duplication**
Extract repeated logic into a single authoritative location. Remove copy-paste branches. Consolidate redundant helpers. Only extract when duplication is exact and the knowledge is the same — do not merge code that merely looks structurally similar but serves different concerns.

**Pass 3 — Naming + error handling**
Rename generic identifiers (`data`, `value`, `temp`, `result`, `obj`, `info`) to intention-revealing names. Ensure errors are explicit and typed — no silent swallowing, no mixed return/error values. Remove noise comments (inline "what" comments, any commented-out code that survived Pass 1).

**Pass 4 — Test reinforcement**
Verify that all behavior touched in Passes 1–3 is covered by tests. For each uncovered path: flag it explicitly in the output — do NOT unilaterally write tests. Report each gap with: file, function/branch, and reason it is uncovered. The caller decides whether to proceed with writing tests or to stop and address coverage first.

---

## Critical Rules

- **Scope is always bounded to changed files only.** Identify them via `git diff`. Never touch a file that is not in the changed set.
- **Run passes sequentially.** Complete Pass 1 before starting Pass 2. Starting Pass 2 without finishing Pass 1 is a violation.
- **Prefer deletion over addition.** But scope rule takes precedence: if a symbol is not in the changed files set and is not provably dead within those files, flag it for manual review — do NOT delete it speculatively. Deletion without scope evidence is a violation of the scope rule.
- **Preserve behavior.** Do NOT refactor logic, restructure architecture, or improve algorithms. Surface-level cleanup only.
- **Lock behavior with tests BEFORE deleting anything that has side effects.** Write the test first, then delete.
- **Review-only mode**: when the calling prompt contains `--review` or when the caller is a read-only reviewer, report slop findings per category only — do NOT edit any file.

---

## Output (≤ 300 tokens)

- **Changed files** scoped by `git diff`
- **What was removed** per pass (Pass 1 / Pass 2 / Pass 3 / Pass 4)
- **Behavior verification** — tests passing / no tests changed / tests added
- **Remaining risks** — any paths that could not be safely cleaned without architectural changes
