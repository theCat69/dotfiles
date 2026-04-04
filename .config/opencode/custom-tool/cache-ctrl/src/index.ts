#!/usr/bin/env bun
import { listCommand } from "./commands/list.js";
import { inspectCommand } from "./commands/inspect.js";
import { flushCommand } from "./commands/flush.js";
import { invalidateCommand } from "./commands/invalidate.js";
import { touchCommand } from "./commands/touch.js";
import { pruneCommand } from "./commands/prune.js";
import { checkFreshnessCommand } from "./commands/checkFreshness.js";
import { checkFilesCommand } from "./commands/checkFiles.js";
import { searchCommand } from "./commands/search.js";
import { ErrorCode } from "./types/result.js";

function printResult(value: unknown, pretty: boolean): void {
  if (pretty) {
    process.stdout.write(JSON.stringify(value, null, 2) + "\n");
  } else {
    process.stdout.write(JSON.stringify(value) + "\n");
  }
}

function printError(error: { ok: false; error: string; code: string }, pretty: boolean): void {
  if (pretty) {
    process.stderr.write(JSON.stringify(error, null, 2) + "\n");
  } else {
    process.stderr.write(JSON.stringify(error) + "\n");
  }
}

function usageError(message: string): never {
  process.stderr.write(JSON.stringify({ ok: false, error: message, code: ErrorCode.INVALID_ARGS }) + "\n");
  process.exit(2);
}

function parseArgs(argv: string[]): { args: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i += 1;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }

  return { args: positional, flags };
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const { args, flags } = parseArgs(rawArgs);
  const pretty = flags.pretty === true;

  const command = args[0];
  if (!command) {
    usageError("Usage: cache-ctrl <command> [args]. Commands: list, inspect, flush, invalidate, touch, prune, check-freshness, check-files, search");
  }

  switch (command) {
    case "list": {
      const agentArg = typeof flags.agent === "string" ? flags.agent : undefined;
      const validAgents = ["external", "local", "all", undefined];
      if (!validAgents.includes(agentArg)) {
        usageError(`Invalid --agent value: "${agentArg}". Must be external, local, or all`);
      }
      const result = await listCommand({ agent: agentArg as "external" | "local" | "all" | undefined });
      if (result.ok) {
        printResult(result, pretty);
      } else {
        printError(result, pretty);
        process.exit(1);
      }
      break;
    }

    case "inspect": {
      const agent = args[1];
      const subject = args[2];
      if (!agent || !subject) {
        usageError("Usage: cache-ctrl inspect <agent> <subject-keyword>");
      }
      if (agent !== "external" && agent !== "local") {
        usageError(`Invalid agent: "${agent}". Must be external or local`);
      }
      const result = await inspectCommand({ agent, subject });
      if (result.ok) {
        printResult(result, pretty);
      } else {
        printError(result, pretty);
        process.exit(1);
      }
      break;
    }

    case "flush": {
      const agent = args[1];
      if (!agent) {
        usageError("Usage: cache-ctrl flush <agent|all> --confirm");
      }
      if (agent !== "external" && agent !== "local" && agent !== "all") {
        usageError(`Invalid agent: "${agent}". Must be external, local, or all`);
      }
      const confirm = flags.confirm === true;
      const result = await flushCommand({ agent, confirm });
      if (result.ok) {
        printResult(result, pretty);
      } else {
        printError(result, pretty);
        process.exit(1);
      }
      break;
    }

    case "invalidate": {
      const agent = args[1];
      if (!agent) {
        usageError("Usage: cache-ctrl invalidate <agent> [subject-keyword]");
      }
      if (agent !== "external" && agent !== "local") {
        usageError(`Invalid agent: "${agent}". Must be external or local`);
      }
      const subject = args[2];
      const result = await invalidateCommand({ agent, ...(subject !== undefined ? { subject } : {}) });
      if (result.ok) {
        printResult(result, pretty);
      } else {
        printError(result, pretty);
        process.exit(1);
      }
      break;
    }

    case "touch": {
      const agent = args[1];
      if (!agent) {
        usageError("Usage: cache-ctrl touch <agent> [subject-keyword]");
      }
      if (agent !== "external" && agent !== "local") {
        usageError(`Invalid agent: "${agent}". Must be external or local`);
      }
      const subject = args[2];
      const result = await touchCommand({ agent, ...(subject !== undefined ? { subject } : {}) });
      if (result.ok) {
        printResult(result, pretty);
      } else {
        printError(result, pretty);
        process.exit(1);
      }
      break;
    }

    case "prune": {
      const agentArg = typeof flags.agent === "string" ? flags.agent : undefined;
      if (agentArg && agentArg !== "external" && agentArg !== "local" && agentArg !== "all") {
        usageError(`Invalid --agent value: "${agentArg}". Must be external, local, or all`);
      }
      const maxAge = typeof flags["max-age"] === "string" ? flags["max-age"] : undefined;
      const doDelete = flags.delete === true;
      const result = await pruneCommand({
        agent: agentArg as "external" | "local" | "all" | undefined,
        maxAge,
        delete: doDelete,
      });
      if (result.ok) {
        printResult(result, pretty);
      } else {
        printError(result, pretty);
        process.exit(1);
      }
      break;
    }

    case "check-freshness": {
      const subject = args[1];
      if (!subject) {
        usageError("Usage: cache-ctrl check-freshness <subject-keyword> [--url <url>]");
      }
      const url = typeof flags.url === "string" ? flags.url : undefined;
      const result = await checkFreshnessCommand({ subject, ...(url !== undefined ? { url } : {}) });
      if (result.ok) {
        printResult(result, pretty);
      } else {
        printError(result, pretty);
        process.exit(1);
      }
      break;
    }

    case "check-files": {
      const result = await checkFilesCommand();
      if (result.ok) {
        printResult(result, pretty);
      } else {
        printError(result, pretty);
        process.exit(1);
      }
      break;
    }

    case "search": {
      const keywords = args.slice(1);
      if (keywords.length === 0) {
        usageError("Usage: cache-ctrl search <keyword> [<keyword>...]");
      }
      const result = await searchCommand({ keywords });
      if (result.ok) {
        printResult(result, pretty);
      } else {
        printError(result, pretty);
        process.exit(1);
      }
      break;
    }

    default:
      usageError(`Unknown command: "${command}". Commands: list, inspect, flush, invalidate, touch, prune, check-freshness, check-files, search`);
  }
}

main().catch((err: unknown) => {
  const error = err as Error;
  process.stderr.write(JSON.stringify({ ok: false, error: error.message, code: ErrorCode.UNKNOWN }) + "\n");
  process.exit(1);
});
