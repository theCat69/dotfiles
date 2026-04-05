# Pattern: Data-driven CLI help printer (printHelp)

Demonstrates a `printHelp(command?: string): void` function that:
- Uses a `Record<CommandName, CommandHelp>` lookup table to keep help data co-located and exhaustive
- Branches on `command` presence/validity with a `Set<string>` guard
- Writes plain text to `process.stdout` (never JSON); caller handles `process.exit`
- Is pure and testable — no side effects beyond stdout write

## Source
`src/index.ts` in `custom-tool/cache-ctrl`

## Code snippet

```typescript
type CommandName = "list" | "inspect" | "flush"; // ... all commands

const KNOWN_COMMANDS = new Set<string>(["list", "inspect", "flush"]);

interface CommandHelp {
  usage: string;
  description: string;
  details: string;
}

const COMMAND_HELP: Record<CommandName, CommandHelp> = {
  list: {
    usage: "list [--agent external|local|all]",
    description: "List all cache entries with age and staleness",
    details: "  Options:\n    --agent external|local|all   Filter by agent type",
  },
  // ... other commands
};

const GLOBAL_OPTIONS_SECTION = [
  "Global options:",
  "  --help    Show help",
  "  --pretty  Pretty-print JSON output",
].join("\n");

export function printHelp(command?: string): void {
  if (command === undefined) {
    // Full help: aligned two-column table
    const maxUsageLen = Math.max(...Object.values(COMMAND_HELP).map((h) => h.usage.length));
    const lines = ["Usage: cache-ctrl <command> [args] [options]", "", "Commands:"];
    for (const [, help] of Object.entries(COMMAND_HELP) as [CommandName, CommandHelp][]) {
      lines.push(`  ${help.usage.padEnd(maxUsageLen)}   ${help.description}`);
    }
    lines.push("", GLOBAL_OPTIONS_SECTION, "", "Run 'cache-ctrl help <command>' for command-specific help.");
    process.stdout.write(lines.join("\n") + "\n");
    return;
  }

  if (!KNOWN_COMMANDS.has(command)) {
    process.stdout.write(`Unknown command: ${command}. Run 'cache-ctrl help' for available commands.\n`);
    return;
  }

  const help = COMMAND_HELP[command as CommandName];
  process.stdout.write(
    [`Usage: cache-ctrl ${help.usage}`, "", `Description: ${help.description}`, "", help.details, "", GLOBAL_OPTIONS_SECTION].join("\n") + "\n",
  );
}
```

## Test pattern

```typescript
let stdoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});
afterEach(() => stdoutSpy.mockRestore());

function capturedOutput(): string {
  return (stdoutSpy.mock.calls as [string | Uint8Array][])
    .map((call) => String(call[0]))
    .join("");
}

it("full help contains all command names", () => {
  printHelp();
  expect(capturedOutput()).toContain("list");
});
```
