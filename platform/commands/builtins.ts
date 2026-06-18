import {
  type CommandContext,
  type CommandResult,
  listCommandDefsForPlatform,
  registerCommand,
} from "./registry.ts";
import { clearAwaitingClarify, readAwaitingClarify } from "@freeanima/capabilities-tools/clarify";
import { resolveMaskPresets } from "@freeanima/capabilities-tasks/mask";
import { statsReport } from "@freeanima/platform/ports/conversation-stats";
import { PARLOR_PLATFORM } from "@freeanima/platform/ports/constants";
import { onSessionCloseBeforeNew } from "@freeanima/platform/ports/session-close";
import { isSessionMeta } from "@freeanima/core/db/domain";
import { setHomeChannel } from "@freeanima/platform/ports/home-channel";
import { getAppRuntime } from "@freeanima/platform/ports";
import {
  formatToolDisplayHelp,
  parseToolDisplayMode,
  resolveSessionHandoffOnNew,
  resolveToolDisplayMode,
} from "../connectors/gateway/tool-display.ts";
import {
  CLI_UPGRADE_HINT_DOCKER,
  CLI_UPGRADE_HINT_SOURCE,
  getCliInstallKind,
} from "@freeanima/core/config/cli-install";

function conv() {
  return getAppRuntime().conversation;
}

function cmdHelp(ctx: CommandContext): string {
  const available = listCommandDefsForPlatform(ctx.platform);
  const sessionCmds = available.filter((c) => (c.scope ?? "session") === "session");
  const globalCmds = available.filter((c) => c.scope === "global");

  const lines = ["**Available commands:**"];
  if (sessionCmds.length) {
    lines.push("", "**Current session:**");
    for (const cmd of sessionCmds) {
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
  const summary = resolveSessionHandoffOnNew(ctx.platform, cfg)
    ? await onSessionCloseBeforeNew(ctx.sessionId)
    : null;
  const sid = await conv().newSession(ctx.platform);
  if (summary) {
    await conv().appendMessage({ role: "assistant", content: summary }, sid);
  }
  return {
    text: `🆕 New session created (${sid.slice(0, 8)}...)`,
    data: { new_session_id: sid },
  };
}

async function cmdToolDisplay(ctx: CommandContext): Promise<string> {
  const cfg = getAppRuntime().engine.config.data;
  const meta = await conv().loadSessionMeta(ctx.sessionId);
  if (!isSessionMeta(meta)) {
    return "⚠️ Current session does not exist.";
  }

  const sub = ctx.args[0]?.trim();
  if (!sub) {
    const effective = resolveToolDisplayMode(meta, cfg);
    const source =
      typeof meta.gateway_tool_display === "string" ? "session override" : "global default";
    return `🔧 Tool display: \`${effective}\` (${source})`;
  }

  if (sub.toLowerCase() === "reset") {
    await conv().updateSessionMetaField(ctx.sessionId, { gateway_tool_display: undefined });
    return `✅ Cleared session tool display override (using global default: \`name\`)`;
  }

  const mode = parseToolDisplayMode(sub);
  if (!mode) {
    return `⚠️ Unknown level. Available: ${formatToolDisplayHelp()}`;
  }

  await conv().updateSessionMetaField(ctx.sessionId, { gateway_tool_display: mode });
  return `✅ Tool display set to \`${mode}\` for this session`;
}

function cmdRetry(_ctx: CommandContext): CommandResult {
  return { text: "", data: { action: "retry" } };
}

async function cmdCancel(ctx: CommandContext): Promise<string> {
  const pending = await readAwaitingClarify(conv(), ctx.sessionId);
  if (!pending) return "No pending questions to answer.";
  await clearAwaitingClarify(conv(), ctx.sessionId);
  return "Question cancelled, you can continue the conversation.";
}

async function cmdRebuildSessionCache(ctx: CommandContext): Promise<string> {
  const meta = await conv().loadSessionMeta(ctx.sessionId);
  if (!isSessionMeta(meta)) {
    return "⚠️ Current session does not exist, cannot rebuild session cache.";
  }
  try {
    const { cachedCount, promoted, systemPromptLength } = await conv().rebuildSessionCache(
      ctx.sessionId,
    );
    const promotedText =
      promoted.length > 0 ? ` (+${promoted.length} promoted: ${promoted.join(", ")})` : "";
    return (
      `✅ Rebuilt session cache\n` +
      `cached_toolsets: ${cachedCount}${promotedText}\n` +
      `system_prompt: ${systemPromptLength} chars`
    );
  } catch (e) {
    return `⚠️ Failed to rebuild session cache: ${String(e)}`;
  }
}

async function cmdStats(ctx: CommandContext): Promise<string> {
  if (ctx.args[0] === "--all" || ctx.args[0] === "-a") {
    return statsReport(null, { allSessions: true });
  }
  return statsReport(ctx.sessionId);
}

async function cmdCwd(ctx: CommandContext): Promise<string> {
  if (!ctx.args.length) {
    const cwd = await conv().getSessionCwd(ctx.sessionId);
    return `📁 Current working directory: ${cwd ?? "(not set)"}`;
  }
  const newCwd = ctx.args.join(" ");
  try {
    const resolved = await conv().setSessionCwd(ctx.sessionId, newCwd);
    return `✅ Working directory switched to: ${resolved}\n(if AGENTS.md exists, content injected into system prompt)`;
  } catch (e) {
    return `❌ ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function cmdTitle(ctx: CommandContext): Promise<string> {
  if (!ctx.args.length) {
    const title = await conv().getSessionTitle(ctx.sessionId);
    return `📝 Current title: ${title || "(empty)"}`;
  }
  const newTitle = ctx.args.join(" ").slice(0, 50);
  await conv().setSessionTitle(ctx.sessionId, newTitle);
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
  const r = await conv().recompressSession(ctx.sessionId, { force });
  if (!r.enabled) {
    return "Session compression not enabled (config.yaml → compression.enabled)";
  }
  const lines = [
    r.updated ? "✅ Updated compression l2/l3" : "ℹ️ l2/l3 unchanged",
    `l2: ${r.l2 ?? "—"}  l3: ${r.l3 ?? "(none, below compression threshold)"}`,
    `stored ${r.stored_total} → runtime ${r.runtime_message_count} (hidden ${r.hidden_by_compression})`,
    `raw segment ${r.window_raw}/${r.recompress_at} (first threshold ${r.threshold})`,
  ];
  if (r.messages_until_recompress != null) {
    lines.push(
      `Until next trim: ~${r.messages_until_recompress} messages (~${r.rounds_until_recompress} rounds)`,
    );
  }
  return lines.join("\n");
}

async function reloadMaskSideEffects(sessionId: string): Promise<void> {
  await conv().recompressSession(sessionId, { force: true });
  await conv().rebuildSessionCache(sessionId);
}

async function cmdMask(ctx: CommandContext): Promise<string> {
  const sub = ctx.args[0]?.toLowerCase();
  const meta = await conv().loadSessionMeta(ctx.sessionId);
  if (!isSessionMeta(meta)) {
    return "⚠️ Current session does not exist, cannot set capability mask.";
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
    await conv().updateSessionMetaField(ctx.sessionId, {
      capability_mask: { presets: [preset] },
    });
    await reloadMaskSideEffects(ctx.sessionId);
    const resolved = resolveMaskPresets([preset], masks, engine.catalog.toolSets);
    return `✅ Set capability mask '${preset}' (${resolved.allowed_tools.length} tools). Compressed and rebuilt session cache.`;
  }

  if (sub === "clear") {
    await conv().updateSessionMetaField(ctx.sessionId, { capability_mask: undefined });
    await reloadMaskSideEffects(ctx.sessionId);
    return "✅ Removed capability mask, restored full capabilities. Compressed and rebuilt session cache.";
  }

  if (sub === "show") {
    const presets = meta.capability_mask?.presets ?? [];
    if (!presets.length) {
      return "ℹ️ Current session has no capability mask (full capabilities).";
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
    description: "Create new session (carries over previous session summary)",
    handler: cmdNew,
    scope: "global",
    platforms: ["discord", "weixin"],
  });
  registerCommand({
    name: "retry",
    description: "Replay last partner message and regenerate reply",
    handler: cmdRetry,
    aliases: ["regenerate"],
    scope: "session",
  });
  registerCommand({
    name: "cancel",
    description: "Cancel current pending clarify question",
    handler: cmdCancel,
    scope: "session",
  });
  registerCommand({
    name: "rebuild_session_cache",
    description:
      "Promote staged ToolSets to cached_toolsets, clear staged_toolsets, and rebuild system_prompt",
    handler: cmdRebuildSessionCache,
    aliases: ["rebuild-session-cache"],
    scope: "session",
  });
  registerCommand({
    name: "stats",
    description: "View current session conversation usage stats (--all aggregates all sessions)",
    handler: cmdStats,
    scope: "session",
  });
  registerCommand({
    name: "cwd",
    description: "View or set current session working directory",
    handler: cmdCwd,
    scope: "session",
  });
  registerCommand({
    name: "title",
    description: "View or modify current session title",
    handler: cmdTitle,
    scope: "session",
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
    description: "Recalculate current session runtime compression (--force ignores hysteresis)",
    handler: cmdCompress,
    scope: "session",
  });
  registerCommand({
    name: "mask",
    description: "Set / view / clear current session capability mask (parlor only)",
    handler: cmdMask,
    scope: "session",
    platforms: [PARLOR_PLATFORM],
  });
  registerCommand({
    name: "tooldisplay",
    description: "View or set gateway tool call display level for this session",
    handler: cmdToolDisplay,
    aliases: ["tool-display"],
    scope: "session",
    platforms: ["discord", "weixin"],
  });
  registerCommand({
    name: "restart",
    description: "Restart Free Anima service (waits for in-flight conversations to flush)",
    handler: cmdRestart,
    scope: "global",
    platforms: ["parlor", "discord", "weixin"],
  });
  registerCommand({
    name: "upgrade",
    description: "Upgrade @freeanima/cli and restart service",
    handler: cmdUpgrade,
    scope: "global",
    platforms: ["parlor", "discord", "weixin"],
  });
}
