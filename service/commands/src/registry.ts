import type { CommandRestartData } from "./restart-data.ts";
import type { CommandRetryData } from "./retry-data.ts";

export type CommandContext = {
  sessionId: string;
  platform: string;
  args: string[];
  raw: string;
  origin_extra?: Record<string, unknown>;
};

export type CommandResult = {
  text: string;
  data?: CommandRetryData | CommandRestartData | Record<string, unknown> | null;
};

export type CommandHandler = (
  ctx: CommandContext,
) => string | CommandResult | Promise<string | CommandResult>;

/** session: affects current session; global: cross-session / platform-level (e.g. help, new) */
export type CommandScope = "session" | "global";

export type CommandDef = {
  name: string;
  description: string;
  handler: CommandHandler;
  aliases?: string[];
  hidden?: boolean;
  /** default session */
  scope?: CommandScope;
  /** whitelist; unset means all platforms */
  platforms?: string[];
};

const registry = new Map<string, CommandDef>();

export function registerCommand(cmd: CommandDef): void {
  registry.set(cmd.name, cmd);
  for (const alias of cmd.aliases ?? []) {
    registry.set(alias, cmd);
  }
}

export function getCommand(name: string): CommandDef | undefined {
  return registry.get(name.toLowerCase());
}

export function listCommandDefs(): CommandDef[] {
  const seen = new Set<CommandDef>();
  const result: CommandDef[] = [];
  for (const cmd of registry.values()) {
    if (seen.has(cmd) || cmd.hidden) continue;
    seen.add(cmd);
    result.push(cmd);
  }
  return result.toSorted((a, b) => a.name.localeCompare(b.name));
}

export function commandAvailableForPlatform(cmd: CommandDef, platform: string): boolean {
  if (!cmd.platforms?.length) return true;
  return cmd.platforms.includes(platform);
}

export function listCommandDefsForPlatform(platform: string): CommandDef[] {
  return listCommandDefs().filter((c) => commandAvailableForPlatform(c, platform));
}

export function findCommand(text: string): [CommandDef | null, string[]] {
  const t = text.trim();
  if (!t.startsWith("/")) return [null, []];
  const parts = t.slice(1).split(/\s+/).filter(Boolean);
  if (!parts.length) return [null, []];
  const cmd = getCommand(parts[0]!);
  if (!cmd) return [null, []];
  return [cmd, parts.slice(1)];
}

/** Match command and verify platform availability */
export function resolveCommand(text: string, platform: string): [CommandDef | null, string[]] {
  const [cmd, args] = findCommand(text);
  if (!cmd) return [null, []];
  if (!commandAvailableForPlatform(cmd, platform)) return [null, []];
  return [cmd, args];
}

export async function executeCommand(cmd: CommandDef, ctx: CommandContext): Promise<CommandResult> {
  const raw = await cmd.handler(ctx);
  if (typeof raw === "string") return { text: raw };
  return raw;
}

export function isRetryResult(result: CommandResult): result is CommandResult & {
  data: CommandRetryData;
} {
  return result.data?.action === "retry";
}

export function isRestartResult(result: CommandResult): result is CommandResult & {
  data: CommandRestartData;
} {
  return result.data?.action === "restart";
}
