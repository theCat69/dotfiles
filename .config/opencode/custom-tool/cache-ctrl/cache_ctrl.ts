import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { listCommand } from "./src/commands/list.js";
import { inspectCommand } from "./src/commands/inspect.js";
import { invalidateCommand } from "./src/commands/invalidate.js";
import { checkFreshnessCommand } from "./src/commands/checkFreshness.js";
import { checkFilesCommand } from "./src/commands/checkFiles.js";
import { searchCommand } from "./src/commands/search.js";
import { writeCommand } from "./src/commands/write.js";

const AgentRequiredSchema = z.enum(["external", "local"]);

export const search = tool({
  description: "Search all cache entries by keyword. Returns ranked list with agent type, subject, description, and staleness info.",
  args: {
    keywords: z.array(z.string().min(1)).min(1),
  },
  async execute(args) {
    try {
      const result = await searchCommand({ keywords: args.keywords });
      return JSON.stringify(result);
    } catch (err) {
      const error = err as Error;
      return JSON.stringify({ ok: false, error: error.message, code: "UNKNOWN" });
    }
  },
});

export const list = tool({
  description: "List all cache entries for the given agent type (external, local, or all) with age and staleness flags.",
  args: {
    agent: z.enum(["external", "local", "all"]).optional().default("all"),
  },
  async execute(args) {
    try {
      const result = await listCommand({ agent: args.agent });
      return JSON.stringify(result);
    } catch (err) {
      const error = err as Error;
      return JSON.stringify({ ok: false, error: error.message, code: "UNKNOWN" });
    }
  },
});

export const inspect = tool({
  description: "Return the full content of a specific cache entry identified by agent type and subject keyword.",
  args: {
    agent: AgentRequiredSchema,
    subject: z.string().min(1),
  },
  async execute(args) {
    try {
      const result = await inspectCommand({ agent: args.agent, subject: args.subject });
      return JSON.stringify(result);
    } catch (err) {
      const error = err as Error;
      return JSON.stringify({ ok: false, error: error.message, code: "UNKNOWN" });
    }
  },
});

export const invalidate = tool({
  description: "Mark a cache entry as stale by zeroing its timestamp. The entry content is preserved. Agent should re-fetch on next run.",
  args: {
    agent: AgentRequiredSchema,
    subject: z.string().optional(),
  },
  async execute(args) {
    try {
      const result = await invalidateCommand({
        agent: args.agent,
        ...(args.subject !== undefined ? { subject: args.subject } : {}),
      });
      return JSON.stringify(result);
    } catch (err) {
      const error = err as Error;
      return JSON.stringify({ ok: false, error: error.message, code: "UNKNOWN" });
    }
  },
});

export const check_freshness = tool({
  description: "For external cache: send HTTP HEAD requests to all source URLs and return freshness status per URL.",
  args: {
    subject: z.string().min(1),
  },
  async execute(args) {
    try {
      const result = await checkFreshnessCommand({ subject: args.subject });
      return JSON.stringify(result);
    } catch (err) {
      const error = err as Error;
      return JSON.stringify({ ok: false, error: error.message, code: "UNKNOWN" });
    }
  },
});

export const check_files = tool({
  description: "For local cache: compare tracked files against stored mtime/hash values and return which files changed.",
  args: {},
  async execute(_args) {
    try {
      const result = await checkFilesCommand();
      return JSON.stringify(result);
    } catch (err) {
      const error = err as Error;
      return JSON.stringify({ ok: false, error: error.message, code: "UNKNOWN" });
    }
  },
});

export const write = tool({
  description:
    "Write a validated cache entry to disk. Validates the content object against the ExternalCacheFile or LocalCacheFile schema before writing. Returns VALIDATION_ERROR if required fields are missing or have wrong types. For 'external': subject arg is required and must match content.subject (or will be injected if absent). For 'local': omit subject. Uses atomic write-with-merge — existing unknown fields in the file are preserved. Call cache_ctrl_schema or read the skill to see required fields before calling this.",
  args: {
    agent: AgentRequiredSchema,
    subject: z.string().min(1).optional(),
    content: z.record(z.string(), z.unknown()),
  },
  async execute(args) {
    try {
      const result = await writeCommand({
        agent: args.agent,
        subject: args.subject,
        content: args.content,
      });
      return JSON.stringify(result);
    } catch (err) {
      const error = err as Error;
      return JSON.stringify({ ok: false, error: error.message, code: "UNKNOWN" });
    }
  },
});
