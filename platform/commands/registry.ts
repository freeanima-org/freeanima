import type { CommandGoalStartData } from "./goal-data.ts";
import type { CommandRestartData } from "./restart-data.ts";
import type { CommandRetryData } from "./retry-data.ts";
import type { CommandUpgradeData } from "./upgrade-data.ts";

export type CommandContext = {
  conversationId: string;
  platform: string;
  args: string[];
  raw: string;
  origin_extra?: Record<string, unknown>;
};

export type CommandResult = {
  text: string;
  data?:
    | CommandRetryData
    | CommandGoalStartData
    | CommandRestartData
    | CommandUpgradeData
    | Record<string, unknown>
    | null;
};

export type CommandHandler = (
  ctx: CommandContext,
) => string | CommandResult | Promise<string | CommandResult>;

/** conversation-scoped: affects current conversation; global: cross-conversation / platform-level (e.g. help, new) */
export type CommandScope = "conversation" | "global";

export type CommandDef = {
  name: string;
  description: string;
  handler: CommandHandler;
  aliases?: string[];
  hidden?: boolean;
  /** default conversation */
  scope?: CommandScope;
  /** whitelist; unset means all platforms; entries may use `*` glob (e.g. `sap:chat:*`) */
  platforms?: string[];
};

const GLOB_ESCAPE_RE = /[.+?^${}()|[\]\\]/g;

/** Whether `platform` satisfies a command platform entry (exact or glob with `*`). */
export function platformMatchesCommandPattern(platform: string, pattern: string): boolean {
  if (pattern === platform) return true;
  if (!pattern.includes("*")) return false;
  const regexSource = pattern.replace(GLOB_ESCAPE_RE, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${regexSource}$`).test(platform);
}

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
  return cmd.platforms.some((pattern) => platformMatchesCommandPattern(platform, pattern));
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

export function isGoalStartResult(result: CommandResult): result is CommandResult & {
  data: CommandGoalStartData;
} {
  return result.data?.action === "goal_start";
}

export function isRestartResult(result: CommandResult): result is CommandResult & {
  data: CommandRestartData;
} {
  return result.data?.action === "restart";
}

export function isUpgradeResult(result: CommandResult): result is CommandResult & {
  data: CommandUpgradeData;
} {
  return result.data?.action === "upgrade";
}

const DEFERRED_SYNC_COMMANDS = new Set([
  "rebuild_conversation_cache",
  "rebuild-conversation-cache",
  "rebuild-session-cache",
  "compress",
  "new",
]);

const PRE_ACK_MESSAGES: Record<string, string> = {
  rebuild_conversation_cache: "⏳ 正在重建会话缓存…",
  "rebuild-conversation-cache": "⏳ 正在重建会话缓存…",
  "rebuild-session-cache": "⏳ 正在重建会话缓存…",
  compress: "⏳ 正在重新计算会话压缩…",
  new: "⏳ 正在创建新会话…",
  mask: "⏳ 正在更新能力面具并重建缓存…",
  stats: "⏳ 正在汇总全部会话统计…",
  retry: "⏳ 正在重新生成回复…",
  regenerate: "⏳ 正在重新生成回复…",
};

/** Whether to yield an ack before the handler runs (blocking sync work). */
export function commandNeedsPreAck(cmd: CommandDef, args: string[]): boolean {
  if (DEFERRED_SYNC_COMMANDS.has(cmd.name)) return true;
  if (cmd.name === "mask") {
    const sub = args[0]?.trim().toLowerCase();
    return sub === "set" || sub === "clear";
  }
  if (cmd.name === "stats") {
    const flag = args[0]?.trim();
    return flag === "--all" || flag === "-a";
  }
  return false;
}

/** Ack text before handler execution for deferred sync commands. */
export function formatCommandPreAck(cmd: CommandDef, _args: string[], _raw: string): string {
  return PRE_ACK_MESSAGES[cmd.name] ?? `⏳ 正在执行 /${cmd.name}…`;
}

/** Ack text before streaming continuation (retry / regenerate). */
export function formatCommandStreamPreAck(cmd: CommandDef): string {
  return PRE_ACK_MESSAGES[cmd.name] ?? `⏳ 正在执行 /${cmd.name}…`;
}

/** Ensure slash commands never return empty user-visible text. */
export function ensureCommandResultText(text: string, cmd: CommandDef): string {
  if (text.trim()) return text;
  return `✅ /${cmd.name} 已完成`;
}
