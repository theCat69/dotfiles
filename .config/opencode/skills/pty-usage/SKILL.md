---
name: pty-usage
description: PTY session management skill — how to correctly spawn, read, and terminate background terminal sessions with the opencode-pty plugin
version: 1.0.0
author: theCat69
type: skill
category: development
tags:
  - pty
  - terminal
  - background
  - long-running
---

# PTY Usage Skill

> **Purpose**: Teach agents how to correctly use `pty_spawn`, `pty_write`, `pty_read`, `pty_list`, and `pty_kill` to manage background terminal **sessions** — especially for long-running tasks.

---

## Prerequisites

- `pty_*` permissions are set to `"allow"` in the agent's permission block.

---

## Vocabulary

Always call it a background **session**, never a "task" or "process". Using the wrong word may cause the agent to fall back to `&` subprocess patterns instead.

---

## Tools Reference

| Tool | Purpose |
|---|---|
| `pty_spawn` | Start a new background session |
| `pty_write` | Send input / key sequences to a running session |
| `pty_read` | Read buffered output (paginated, filterable) |
| `pty_list` | List all sessions (running + exited) |
| `pty_kill` | Terminate a session and optionally free its buffer |

---

## Session Lifecycle

```
spawn → running
           │
           ├─ command exits naturally → status: "exited", exitCode set
           ├─ pty_kill called         → status: "killed"
           │
           └─ session stays in pty_list until pty_kill(cleanup=true)
```

---

## Pattern 1 — Long-running command (build, test, compile)

Use `notifyOnExit: true`. Do NOT poll with `pty_read` loops.

```
1. pty_spawn(command="npm", args=["run","build"], notifyOnExit=true)
2. Wait for the <pty_exited> message (contains: id, exitCode, lineCount, lastLine)
3. If exitCode != 0 → call pty_read(id) to inspect errors
4. pty_kill(id, cleanup=true) when done
```

**Critical:** The `<pty_exited>` signal is the authoritative completion signal. Never assume the session is done before receiving it.

---

## Pattern 2 — Background server (dev server, watcher — no exit expected)

```
1. pty_spawn(command="npm", args=["run","dev"], title="Dev Server")
   → returns id, e.g. "pty_abc12345"
2. Wait a moment, then pty_read(id, limit=50) to verify startup
3. Filter for errors: pty_read(id, pattern="error|failed", ignoreCase=true)
4. When done: pty_write(id, "\x03") to send Ctrl+C, then pty_kill(id, cleanup=true)
```

---

## Pattern 3 — Interactive prompt

```
1. pty_spawn(command="bash", title="Interactive")
2. pty_write(id, "some-command\n")      ← \n submits the line
3. pty_read(id) to see output
4. pty_write(id, "\x04") to send Ctrl+D (EOF) when done
5. pty_kill(id, cleanup=true)
```

---

## Reading Output

`pty_read` parameters:
- `offset` — 0-based line index to start from (use `totalLines - N` to tail)
- `limit` — max lines to return (default 500)
- `pattern` — regex filter applied **before** offset/limit; original line numbers preserved
- `ignoreCase` — case-insensitive pattern match (default false)

**Tip — tail recent output:**
```
pty_read(id, offset=totalLines-100, limit=100)
```

**Tip — find errors:**
```
pty_read(id, pattern="ERROR|WARN|FATAL")
```

Buffer maximum: 50,000 lines (`PTY_MAX_BUFFER_LINES`). Older lines are discarded when the cap is reached.

---

## Handling the "Exited Too Early" Problem

The most common agent mistake: receiving a `<pty_exited>` signal and assuming the work is done when it is not.

**Causes:**
- The spawned command is a **wrapper/launcher** (e.g., a shell script that forks background children and exits immediately). The exit signals the wrapper, not the real work.
- The agent calls `pty_read` before output is flushed, sees partial output, and incorrectly concludes success.

**Rules:**
1. Always check `exitCode` in the `<pty_exited>` message. A non-zero code means failure.
2. If `exitCode == 0` but you expected output, call `pty_read(id)` before treating the task as complete.
3. If the real work runs as a background child of the spawned command (e.g., `./start.sh` launches a daemon), do not rely on the wrapper's exit signal — monitor process output instead via `pty_read` with a pattern or tail.
4. Never call `pty_kill(cleanup=true)` before verifying output — it destroys the buffer.

---

## Key Escape Sequences for `pty_write`

| Sequence | Meaning |
|---|---|
| `\n` or `\r` | Enter / submit line |
| `\x03` | Ctrl+C — interrupt process |
| `\x04` | Ctrl+D — EOF / end of input |
| `\x1a` | Ctrl+Z — suspend process |
| `\t` | Tab — autocomplete |
| `\x1b[A` | Arrow Up |
| `\x1b[B` | Arrow Down |

---

## Cleanup

Always clean up sessions when done to free memory:

```
pty_kill(id, cleanup=true)
```

If you only need to stop the process but may want to inspect logs later:

```
pty_kill(id, cleanup=false)   ← kills process, keeps buffer
```

---

## Anti-Patterns (Never Do These)

- ❌ Polling `pty_read` in a loop to detect completion — use `notifyOnExit=true` instead
- ❌ Calling `pty_kill(cleanup=true)` before reading output
- ❌ Treating wrapper-process exit as task completion without verifying output
- ❌ Ignoring `exitCode` — always check it
- ❌ Using `sleep` + `pty_read` as a substitute for `notifyOnExit`

---

## Permission Requirements

Agent frontmatter must include:

```yaml
"pty_*": "allow"
```

> ⚠️ The `"ask"` permission value is treated as `"deny"` by the opencode-pty plugin. Always use explicit `"allow"` or `"deny"`.
