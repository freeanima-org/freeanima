import {
  type CommandContext,
  type CommandResult,
  listCommandDefsForPlatform,
  registerCommand,
} from "./registry.ts";
import { clearAwaitingClarify, readAwaitingClarify } from "@freeanima/capabilities-tools/clarify";
import { resolveMaskPresets } from "@freeanima/capabilities-task/mask";
import { statsReport } from "@freeanima/platform/ports/conversation-stats";
import { CHAT_PLATFORM_PATTERN } from "@freeanima/platform/ports/constants";
import { formatCompressionDiagnostics, getCompressionConfig } from "@freeanima/core/compress";
import type { CompressionAnalysis } from "@freeanima/core/compress";
import { onConversationCloseBeforeNew } from "@freeanima/platform/ports/conversation-close";
import { isConversationMeta } from "@freeanima/core/db/domain";
import { setHomeChannel } from "@freeanima/platform/ports/home-channel";
import { getAppRuntime } from "@freeanima/platform/ports";
import {
  formatToolDisplayHelp,
  parseToolDisplayMode,
  resolveConversationHandoffOnNew,
  resolveToolDisplayMode,
} from "../connectors/gateway/tool-display.ts";
import {
  CLI_UPGRADE_HINT_DOCKER,
  CLI_UPGRADE_HINT_SOURCE,
  getCliInstallKind,
} from "@freeanima/core/config/cli-install";
import {
  addSubgoal,
  clearGoal,
  clearSubgoals,
  formatGoalSetMessage,
  formatGoalStartPrompt,
  formatGoalStatus,
  formatSubgoalList,
  pauseConversationGoal,
  readConversationGoal,
  removeSubgoal,
  resumeConversationGoal,
  setConversationGoal,
} from "@freeanima/runtime/goal";

function conv() {
  return getAppRuntime().conversation;
}

function cmdHelp(ctx: CommandContext): string {
  const available = listCommandDefsForPlatform(ctx.platform);
  const conversationCmds = available.filter((c) => (c.scope ?? "conversation") === "conversation");
  const globalCmds = available.filter((c) => c.scope === "global");

  const lines = ["**Available commands:**"];
  if (conversationCmds.length) {
    lines.push("", "**Current conversation:**");
    for (const cmd of conversationCmds) {
      lines.push(`  • \`/${cmd.name}\` — ${cmd.description}`);
    }
  }
  if (globalCmds.length) {
    lines.push("", "**Other:**");
    for (const cmd of globalCmds) {
      lines.push(`  • \`/${cmd.name}\` — ${cmd.description}`);
    }
  }
  return lines.join("\n");
}

async function cmdNew(ctx: CommandContext): Promise<CommandResult> {
  const cfg = getAppRuntime().engine.config.data;
  const summary = resolveConversationHandoffOnNew(ctx.platform, cfg)
    ? await onConversationCloseBeforeNew(ctx.conversationId)
    : null;
  const sid = await conv().newConversation(ctx.platform);
  if (summary) {
    await conv().appendMessage({ role: "assistant", content: summary }, sid);
  }
  return {
    text: `🆕 New conversation created (${sid.slice(0, 8)}...)`,
    data: { new_conversation_id: sid },
  };
}

async function cmdToolDisplay(ctx: CommandContext): Promise<string> {
  const cfg = getAppRuntime().engine.config.data;
  const meta = await conv().loadConversationMeta(ctx.conversationId);
  if (!isConversationMeta(meta)) {
    return "⚠️ Current conversation does not exist.";
  }

  const sub = ctx.args[0]?.trim();
  if (!sub) {
    const effective = resolveToolDisplayMode(meta, cfg);
    const source =
      typeof meta.gateway_tool_display === "string" ? "conversation override" : "global default";
    return `🔧 Tool display: \`${effective}\` (${source})`;
  }

  if (sub.toLowerCase() === "reset") {
    await conv().updateConversationMetaField(ctx.conversationId, {
      gateway_tool_display: undefined,
    });
    return `✅ Cleared conversation tool display override (using global default: \`name\`)`;
  }

  const mode = parseToolDisplayMode(sub);
  if (!mode) {
    return `⚠️ Unknown level. Available: ${formatToolDisplayHelp()}`;
  }

  await conv().updateConversationMetaField(ctx.conversationId, { gateway_tool_display: mode });
  return `✅ Tool display set to \`${mode}\` for this conversation`;
}

function cmdRetry(_ctx: CommandContext): CommandResult {
  return { text: "", data: { action: "retry" } };
}

async function cmdGoal(ctx: CommandContext): Promise<string | CommandResult> {
  const sub = ctx.args[0]?.trim().toLowerCase();
  if (sub === "status") {
    const goal = await readConversationGoal(conv(), ctx.conversationId);
    if (!goal) return "No active goal. Use `/goal <description>` to set one.";
    return formatGoalStatus(goal);
  }
  if (sub === "pause") {
    const goal = await pauseConversationGoal(conv(), ctx.conversationId);
    if (!goal) return "No goal to pause.";
    return "⏸ Goal paused (state preserved). Use `/goal resume` to continue auto-run.";
  }
  if (sub === "resume") {
    const goal = await resumeConversationGoal(conv(), ctx.conversationId);
    if (!goal) return "No paused goal to resume.";
    return "▶ Goal resumed.";
  }
  if (sub === "clear") {
    await clearGoal(conv(), ctx.conversationId);
    return "🗑 Goal cleared.";
  }

  const description = ctx.args.join(" ").trim();
  if (!description) {
    return "Usage: `/goal <description>` | `/goal status` | `/goal pause` | `/goal resume` | `/goal clear`";
  }

  const goal = await setConversationGoal(conv(), ctx.conversationId, description);
  const prompt = formatGoalStartPrompt(description);
  return {
    text: formatGoalSetMessage(goal.max_turns),
    data: { action: "goal_start", prompt },
  };
}

async function cmdSubgoal(ctx: CommandContext): Promise<string> {
  const sub = ctx.args[0]?.trim().toLowerCase();
  const goal = await readConversationGoal(conv(), ctx.conversationId);
  if (!goal) return "No active goal. Set one with `/goal <description>` first.";

  if (!sub) {
    return formatSubgoalList(goal);
  }
  if (sub === "clear") {
    await clearSubgoals(conv(), ctx.conversationId);
    return "🗑 Subgoals cleared.";
  }
  if (sub === "remove") {
    const idx = Number.parseInt(ctx.args[1] ?? "", 10);
    if (!Number.isFinite(idx) || idx < 1) {
      return "Usage: `/subgoal remove <N>` (1-based index)";
    }
    const updated = await removeSubgoal(conv(), ctx.conversationId, idx);
    if (!updated) return "No goal.";
    return formatSubgoalList(updated);
  }

  const condition = ctx.args.join(" ").trim();
  if (!condition) {
    return "Usage: `/subgoal <condition>` | `/subgoal remove <N>` | `/subgoal clear`";
  }
  const updated = await addSubgoal(conv(), ctx.conversationId, condition);
  return `➕ Subgoal added.\n\n${formatSubgoalList(updated!)}`;
}

async function cmdCancel(ctx: CommandContext): Promise<string> {
  const pending = await readAwaitingClarify(conv(), ctx.conversationId);
  if (!pending) return "No pending questions to answer.";
  await clearAwaitingClarify(conv(), ctx.conversationId);
  return "Question cancelled, you can continue the conversation.";
}

async function cmdRebuildConversationCache(ctx: CommandContext): Promise<string> {
  const meta = await conv().loadConversationMeta(ctx.conversationId);
  if (!isConversationMeta(meta)) {
    return "⚠️ Current conversation does not exist, cannot rebuild conversation cache.";
  }
  try {
    const { cachedCount, promoted, systemPromptLength } = await conv().rebuildConversationCache(
      ctx.conversationId,
    );
    const promotedText =
      promoted.length > 0 ? ` (+${promoted.length} promoted: ${promoted.join(", ")})` : "";
    return (
      `✅ Rebuilt conversation cache\n` +
      `cached_toolsets: ${cachedCount}${promotedText}\n` +
      `system_prompt: ${systemPromptLength} chars`
    );
  } catch (e) {
    return `⚠️ Failed to rebuild conversation cache: ${String(e)}`;
  }
}

async function cmdStats(ctx: CommandContext): Promise<string> {
  if (ctx.args[0] === "--all" || ctx.args[0] === "-a") {
    return statsReport(null, { allConversations: true });
  }
  return statsReport(ctx.conversationId);
}

async function cmdCwd(ctx: CommandContext): Promise<string> {
  if (!ctx.args.length) {
    const cwd = await conv().getConversationCwd(ctx.conversationId);
    return `📁 Current working directory: ${cwd ?? "(not set)"}`;
  }
  const newCwd = ctx.args.join(" ");
  try {
    const resolved = await conv().setConversationCwd(ctx.conversationId, newCwd);
    return `✅ Working directory switched to: ${resolved}\n(if AGENTS.md exists, content injected into system prompt)`;
  } catch (e) {
    return `❌ ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function cmdTitle(ctx: CommandContext): Promise<string> {
  if (!ctx.args.length) {
    const title = await conv().getConversationTitle(ctx.conversationId);
    return `📝 Current title: ${title || "(empty)"}`;
  }
  const newTitle = ctx.args.join(" ").slice(0, 50);
  await conv().setConversationTitle(ctx.conversationId, newTitle);
  return `✅ Title updated: ${newTitle}`;
}

function cmdSethome(ctx: CommandContext): string {
  const extra = ctx.origin_extra;
  if (!extra) {
    return "⚠️ /sethome only works in Discord or WeChat chat.";
  }

  if (ctx.platform === "discord") {
    const channelId = String(extra.channel_id ?? "").trim();
    if (!channelId) {
      return "⚠️ Cannot identify current Discord channel.";
    }
    const threadId = String(extra.thread_id ?? "").trim();
    setHomeChannel("discord", channelId, threadId || undefined);
    const where = threadId ? `channel ${channelId} / thread ${threadId}` : `channel ${channelId}`;
    return `✅ Set Discord home channel to ${where}(cron delivery etc. will default here)`;
  }

  if (ctx.platform === "weixin") {
    const peerId = String(extra.weixin_peer_id ?? "").trim();
    if (!peerId) {
      return "⚠️ Cannot identify current WeChat session.";
    }
    setHomeChannel("weixin", peerId);
    return `✅ Set WeChat home channel to ${peerId}(cron delivery etc. will default here)`;
  }

  return "⚠️ /sethome only works in Discord or WeChat chat.";
}

async function cmdCompress(ctx: CommandContext): Promise<string> {
  const force = ctx.args.includes("--force") || ctx.args.includes("-f");
  const r = (await conv().recompressConversation(ctx.conversationId, { force })) as Record<
    string,
    unknown
  > &
    CompressionAnalysis & { updated?: boolean };
  if (!r.enabled) {
    return "Session compression not enabled (config.yaml → compression.enabled)";
  }
  const cfg = getCompressionConfig();
  const lines = [
    r.updated ? "✅ Updated compression l2/l3" : "ℹ️ l2/l3 unchanged",
    `l2: ${r.l2 ?? "—"}  l3: ${r.l3 ?? "(none, below compression threshold)"}`,
    ...formatCompressionDiagnostics(r, cfg, { includeStorageSummary: true }),
  ];
  return lines.join("\n");
}

async function reloadMaskSideEffects(conversationId: string): Promise<void> {
  await conv().recompressConversation(conversationId, { force: true });
  await conv().rebuildConversationCache(conversationId);
}

async function cmdMask(ctx: CommandContext): Promise<string> {
  const sub = ctx.args[0]?.toLowerCase();
  const meta = await conv().loadConversationMeta(ctx.conversationId);
  if (!isConversationMeta(meta)) {
    return "⚠️ Current conversation does not exist, cannot set capability mask.";
  }

  if (sub === "set") {
    const preset = ctx.args[1]?.trim();
    if (!preset) {
      return "Usage: `/mask set <preset-name>`";
    }
    const { masks, engine } = getAppRuntime();
    if (!masks.get(preset)) {
      const known = masks
        .list()
        .map((m) => m.name)
        .join(", ");
      return `⚠️ Unknown mask '${preset}'. Available: ${known || "(none)"}`;
    }
    await conv().updateConversationMetaField(ctx.conversationId, {
      capability_mask: { presets: [preset] },
    });
    await reloadMaskSideEffects(ctx.conversationId);
    const resolved = resolveMaskPresets([preset], masks, engine.catalog.toolSets);
    return `✅ Set capability mask '${preset}' (${resolved.allowed_tools.length} tools). Compressed and rebuilt conversation cache.`;
  }

  if (sub === "clear") {
    await conv().updateConversationMetaField(ctx.conversationId, { capability_mask: undefined });
    await reloadMaskSideEffects(ctx.conversationId);
    return "✅ Removed capability mask, restored full capabilities. Compressed and rebuilt conversation cache.";
  }

  if (sub === "show") {
    const presets = meta.capability_mask?.presets ?? [];
    if (!presets.length) {
      return "ℹ️ Current conversation has no capability mask (full capabilities).";
    }
    const { masks, engine } = getAppRuntime();
    const resolved = resolveMaskPresets(presets, masks, engine.catalog.toolSets);
    const preview =
      resolved.allowed_tools.length <= 12
        ? resolved.allowed_tools.join(", ")
        : `${resolved.allowed_tools.slice(0, 12).join(", ")}… (total ${resolved.allowed_tools.length})`;
    return [
      `🎭 Capability mask: ${presets.join(", ")}`,
      `Allowed tools: ${preview || "(none)"}`,
    ].join("\n");
  }

  return "Usage: `/mask set <preset>` | `/mask clear` | `/mask show`";
}

function cmdRestart(_ctx: CommandContext): CommandResult | string {
  if (getAppRuntime().isShuttingDown()) {
    return "Service is already restarting…";
  }
  return {
    text: "🔄 Restarting service (waiting for in-flight conversations to flush)…",
    data: { action: "restart" },
  };
}

function cmdUpgrade(_ctx: CommandContext): CommandResult | string {
  if (getAppRuntime().isShuttingDown()) {
    return "Service is already restarting…";
  }
  const kind = getCliInstallKind();
  if (kind === "source") {
    return `⛔ ${CLI_UPGRADE_HINT_SOURCE}`;
  }
  if (kind === "docker") {
    return `⛔ ${CLI_UPGRADE_HINT_DOCKER}`;
  }
  const text =
    kind === "npm-local"
      ? "⬆️ 正在从本地仓库升级 CLI 并重启服务（等待进行中的对话结束）…"
      : "⬆️ 正在从 npm 升级 @freeanima/cli 并重启服务（等待进行中的对话结束）…";
  return {
    text,
    data: { action: "upgrade" },
  };
}

export function registerBuiltins(): void {
  registerCommand({
    name: "help",
    description: "List all available commands",
    handler: cmdHelp,
    aliases: ["commands"],
    scope: "global",
  });
  registerCommand({
    name: "new",
    description: "Create new conversation (carries over previous conversation summary)",
    handler: cmdNew,
    scope: "global",
    platforms: ["discord", "weixin"],
  });
  registerCommand({
    name: "retry",
    description: "Replay last partner message and regenerate reply",
    handler: cmdRetry,
    aliases: ["regenerate"],
    scope: "conversation",
  });
  registerCommand({
    name: "goal",
    description: "Set or manage conversation goal (auto-continue until done or budget exhausted)",
    handler: cmdGoal,
    scope: "conversation",
  });
  registerCommand({
    name: "subgoal",
    description: "Add or manage subgoals for the current conversation goal",
    handler: cmdSubgoal,
    scope: "conversation",
  });
  registerCommand({
    name: "cancel",
    description: "Cancel current pending clarify question",
    handler: cmdCancel,
    scope: "conversation",
  });
  registerCommand({
    name: "rebuild_conversation_cache",
    description:
      "Promote staged ToolSets to cached_toolsets, clear staged_toolsets, and rebuild system_prompt",
    handler: cmdRebuildConversationCache,
    aliases: ["rebuild-conversation-cache", "rebuild-session-cache"],
    scope: "conversation",
  });
  registerCommand({
    name: "stats",
    description: "View current conversation usage stats (--all aggregates all conversations)",
    handler: cmdStats,
    scope: "conversation",
  });
  registerCommand({
    name: "cwd",
    description: "View or set current conversation working directory",
    handler: cmdCwd,
    scope: "conversation",
  });
  registerCommand({
    name: "title",
    description: "View or modify current conversation title",
    handler: cmdTitle,
    scope: "conversation",
  });
  registerCommand({
    name: "sethome",
    description:
      "Set current chat as platform home channel (default delivery target for cron etc.)",
    handler: cmdSethome,
    aliases: ["set-home"],
    scope: "global",
    platforms: ["discord", "weixin"],
  });
  registerCommand({
    name: "compress",
    description:
      "Recalculate current conversation runtime compression (--force ignores hysteresis)",
    handler: cmdCompress,
    scope: "conversation",
  });
  registerCommand({
    name: "mask",
    description: "Set / view / clear current conversation capability mask (chat only)",
    handler: cmdMask,
    scope: "conversation",
    platforms: [CHAT_PLATFORM_PATTERN],
  });
  registerCommand({
    name: "tooldisplay",
    description: "View or set gateway tool call display level for this conversation",
    handler: cmdToolDisplay,
    aliases: ["tool-display"],
    scope: "conversation",
    platforms: ["discord", "weixin"],
  });
  registerCommand({
    name: "restart",
    description: "Restart Free Anima service (waits for in-flight conversations to flush)",
    handler: cmdRestart,
    scope: "global",
    platforms: [CHAT_PLATFORM_PATTERN, "discord", "weixin"],
  });
  registerCommand({
    name: "upgrade",
    description: "Upgrade @freeanima/cli and restart service",
    handler: cmdUpgrade,
    scope: "global",
    platforms: [CHAT_PLATFORM_PATTERN, "discord", "weixin"],
  });
}
