import {
  type CommandContext,
  type CommandResult,
  listCommandDefsForPlatform,
  registerCommand,
} from "./registry.ts";
import {
  clearAwaitingClarify,
  readAwaitingClarify,
} from "@freeanima/habitat/capabilities/tools/clarify";
import { statsReport } from "@freeanima/habitat/platform/ports/conversation-stats";
import { CHAT_PLATFORM_PATTERN } from "@freeanima/habitat/platform/ports/constants";
import {
  formatCompressionDiagnostics,
  getCompressionConfig,
} from "@freeanima/habitat/core/compress";
import type { CompressionAnalysis } from "@freeanima/habitat/core/compress";
import { onConversationCloseBeforeNew } from "@freeanima/habitat/platform/ports/conversation-close";
import { isConversationMeta } from "@freeanima/habitat/core/db/domain";
import { setHomeChannel } from "@freeanima/habitat/platform/ports/home-channel";
import { getAppRuntime } from "@freeanima/habitat/platform/ports";
import {
  formatToolDisplayHelp,
  parseToolDisplayMode,
  resolveConversationHandoffOnNew,
  resolveToolDisplayMode,
} from "@freeanima/habitat/capabilities/connectors/gateway/tool-display.ts";
import {
  CLI_UPGRADE_HINT_SOURCE,
  getCliInstallKind,
} from "@freeanima/habitat/core/config/cli-install";
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
} from "@freeanima/habitat/engine/goal";
import type { CommandSkillReviewData } from "./skill-review-data.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

function conv() {
  return getAppRuntime().conversation;
}

function asPanel(text: string): CommandResult {
  return { text, ux: "panel" };
}

function asToast(text: string): CommandResult {
  return { text, ux: "toast" };
}

function cmdHelp(ctx: CommandContext): CommandResult {
  const available = listCommandDefsForPlatform(ctx.platform);
  const conversationCmds = available.filter((c) => (c.scope ?? "conversation") === "conversation");
  const globalCmds = available.filter((c) => c.scope === "global");

  const lines = ["**Available commands:**"];
  if (conversationCmds.length > 0) {
    lines.push("", "**Current conversation:**");
    for (const cmd of conversationCmds) {
      lines.push(`  • \`/${cmd.name}\` — ${cmd.description}`);
    }
  }
  if (globalCmds.length > 0) {
    lines.push("", "**Other:**");
    for (const cmd of globalCmds) {
      lines.push(`  • \`/${cmd.name}\` — ${cmd.description}`);
    }
  }
  return asPanel(lines.join("\n"));
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
    ux: "toast",
    data: { new_conversation_id: sid },
  };
}

async function cmdToolDisplay(ctx: CommandContext): Promise<CommandResult> {
  const cfg = getAppRuntime().engine.config.data;
  const meta = await conv().loadConversationMeta(ctx.conversationId);
  if (!isConversationMeta(meta)) {
    return asToast("⚠️ Current conversation does not exist.");
  }

  const sub = ctx.args[0]?.trim();
  if (!sub) {
    const effective = resolveToolDisplayMode(meta, cfg);
    const source =
      typeof meta.gateway_tool_display === "string" ? "conversation override" : "global default";
    return asPanel(`🔧 Tool display: \`${effective}\` (${source})`);
  }

  if (sub.toLowerCase() === "reset") {
    await conv().updateConversationMetaField(ctx.conversationId, {
      gateway_tool_display: undefined,
    });
    return asToast(
      `✅ Cleared conversation tool display override (using global default: \`name\`)`,
    );
  }

  const mode = parseToolDisplayMode(sub);
  if (!mode) {
    return asPanel(`⚠️ Unknown level. Available: ${formatToolDisplayHelp()}`);
  }

  await conv().updateConversationMetaField(ctx.conversationId, { gateway_tool_display: mode });
  return asToast(`✅ Tool display set to \`${mode}\` for this conversation`);
}

function cmdRetry(_ctx: CommandContext): CommandResult {
  return { text: "", data: { action: "retry" } };
}

async function cmdGoal(ctx: CommandContext): Promise<CommandResult> {
  const sub = ctx.args[0]?.trim().toLowerCase();
  if (sub === "status") {
    const goal = await readConversationGoal(conv(), ctx.conversationId);
    if (!goal) return asPanel("No active goal. Use `/goal <description>` to set one.");
    return asPanel(formatGoalStatus(goal));
  }
  if (sub === "pause") {
    const goal = await pauseConversationGoal(conv(), ctx.conversationId);
    if (!goal) return asToast("No goal to pause.");
    return asToast("⏸ Goal paused (state preserved). Use `/goal resume` to continue auto-run.");
  }
  if (sub === "resume") {
    const goal = await resumeConversationGoal(conv(), ctx.conversationId);
    if (!goal) return asToast("No paused goal to resume.");
    return asToast("▶ Goal resumed.");
  }
  if (sub === "clear") {
    await clearGoal(conv(), ctx.conversationId);
    return asToast("🗑 Goal cleared.");
  }

  const description = ctx.args.join(" ").trim();
  if (!description) {
    return asPanel(
      "Usage: `/goal <description>` | `/goal status` | `/goal pause` | `/goal resume` | `/goal clear`",
    );
  }

  const goal = await setConversationGoal(conv(), ctx.conversationId, description);
  const prompt = formatGoalStartPrompt(description);
  return {
    text: formatGoalSetMessage(goal.max_continues),
    ux: "toast",
    data: { action: "goal_start", prompt },
  };
}

async function cmdSubgoal(ctx: CommandContext): Promise<CommandResult> {
  const sub = ctx.args[0]?.trim().toLowerCase();
  const goal = await readConversationGoal(conv(), ctx.conversationId);
  if (!goal) return asToast("No active goal. Set one with `/goal <description>` first.");

  if (!sub) {
    return asPanel(formatSubgoalList(goal));
  }
  if (sub === "clear") {
    await clearSubgoals(conv(), ctx.conversationId);
    return asToast("🗑 Subgoals cleared.");
  }
  if (sub === "remove") {
    const idx = Number.parseInt(ctx.args[1] ?? "", 10);
    if (!Number.isFinite(idx) || idx < 1) {
      return asPanel("Usage: `/subgoal remove <N>` (1-based index)");
    }
    const updated = await removeSubgoal(conv(), ctx.conversationId, idx);
    if (!updated) return asToast("No goal.");
    return asPanel(formatSubgoalList(updated));
  }

  const condition = ctx.args.join(" ").trim();
  if (!condition) {
    return asPanel("Usage: `/subgoal <condition>` | `/subgoal remove <N>` | `/subgoal clear`");
  }
  const updated = await addSubgoal(conv(), ctx.conversationId, condition);
  if (!updated) return asToast("➕ Subgoal added.");
  return asPanel(`➕ Subgoal added.\n\n${formatSubgoalList(updated)}`);
}

function cmdLearn(ctx: CommandContext): CommandResult {
  const note = ctx.args.join(" ").trim();
  const data: CommandSkillReviewData = {
    action: "skill_review",
    mode: "evolve",
    force: true,
    ...(note ? { note } : {}),
  };
  return {
    text: note
      ? `📚 Skill learn queued (note: ${note}).`
      : "📚 Skill learn queued from this conversation.",
    ux: "toast",
    data,
  };
}

function cmdSkills(ctx: CommandContext): CommandResult {
  const sub = ctx.args[0]?.trim().toLowerCase();
  if (sub === "curate" || sub === "maintain") {
    const note = ctx.args.slice(1).join(" ").trim();
    const data: CommandSkillReviewData = {
      action: "skill_review",
      mode: "maintain",
      ...(note ? { note } : {}),
    };
    return {
      text: "🧹 Skill maintain queued.",
      ux: "toast",
      data,
    };
  }
  return asPanel(
    "Usage: `/skills curate` — review skill library (maintain bypass)\n`/learn [note]` — force skill evolve from this conversation",
  );
}

async function cmdCancel(ctx: CommandContext): Promise<CommandResult> {
  const pending = await readAwaitingClarify(conv(), ctx.conversationId);
  if (!pending) return asToast("No pending questions to answer.");
  await clearAwaitingClarify(conv(), ctx.conversationId);
  return asToast("Question cancelled, you can continue the conversation.");
}

async function cmdRebuildConversationCache(ctx: CommandContext): Promise<CommandResult> {
  const meta = await conv().loadConversationMeta(ctx.conversationId);
  if (!isConversationMeta(meta)) {
    return asToast("⚠️ Current conversation does not exist, cannot rebuild conversation cache.");
  }
  try {
    const { cachedCount, promoted, systemPromptLength } = await conv().rebuildConversationCache(
      ctx.conversationId,
    );
    const promotedText =
      promoted.length > 0 ? ` (+${promoted.length} promoted: ${promoted.join(", ")})` : "";
    return asPanel(
      `✅ Rebuilt conversation cache\n` +
        `cached_toolsets: ${cachedCount}${promotedText}\n` +
        `system_prompt: ${systemPromptLength} chars`,
    );
  } catch (e) {
    return asToast(`⚠️ Failed to rebuild conversation cache: ${String(e)}`);
  }
}

async function cmdStats(ctx: CommandContext): Promise<CommandResult> {
  if (ctx.args[0] === "--all" || ctx.args[0] === "-a") {
    return asPanel(await statsReport(null, { allConversations: true }));
  }
  return asPanel(await statsReport(ctx.conversationId));
}

async function cmdCwd(ctx: CommandContext): Promise<CommandResult> {
  if (ctx.args.length === 0) {
    const cwd = await conv().getConversationCwd(ctx.conversationId);
    return asPanel(`📁 Current working directory: ${cwd ?? "(not set)"}`);
  }
  const newCwd = ctx.args.join(" ");
  try {
    const resolved = await conv().setConversationCwd(ctx.conversationId, newCwd);
    return asToast(
      `✅ Working directory switched to: ${resolved}\n(if AGENTS.md exists, content injected into system prompt)`,
    );
  } catch (e) {
    return asToast(`❌ ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function cmdTitle(ctx: CommandContext): Promise<CommandResult> {
  if (ctx.args.length === 0) {
    const title = await conv().getConversationTitle(ctx.conversationId);
    return asPanel(`📝 Current title: ${title || "(empty)"}`);
  }
  const newTitle = ctx.args.join(" ").slice(0, 50);
  await conv().setConversationTitle(ctx.conversationId, newTitle);
  return asToast(`✅ Title updated: ${newTitle}`);
}

async function cmdSethome(ctx: CommandContext): Promise<CommandResult> {
  const extra = ctx.origin_extra;
  if (!extra) {
    return asToast("⚠️ /sethome only works in Discord or WeChat chat.");
  }

  if (ctx.platform === "discord") {
    const channelId = coerceString(extra.channel_id ?? "").trim();
    if (!channelId) {
      return asToast("⚠️ Cannot identify current Discord channel.");
    }
    const threadId = coerceString(extra.thread_id ?? "").trim();
    await setHomeChannel("discord", channelId, threadId || undefined);
    const where = threadId ? `channel ${channelId} / thread ${threadId}` : `channel ${channelId}`;
    return asToast(`✅ Set Discord home channel to ${where}(cron delivery etc. will default here)`);
  }

  if (ctx.platform === "weixin") {
    const peerId = coerceString(extra.weixin_peer_id ?? "").trim();
    if (!peerId) {
      return asToast("⚠️ Cannot identify current WeChat session.");
    }
    await setHomeChannel("weixin", peerId);
    return asToast(`✅ Set WeChat home channel to ${peerId}(cron delivery etc. will default here)`);
  }

  return asToast("⚠️ /sethome only works in Discord or WeChat chat.");
}

async function cmdSummarize(ctx: CommandContext): Promise<CommandResult> {
  const r = (await conv().summarizeConversation(ctx.conversationId)) as Record<string, unknown> &
    CompressionAnalysis & {
      updated?: boolean;
      idle?: boolean;
      error?: string;
      summary_run_id?: string;
      summary_error?: string;
      compression?: { summary?: string };
    };

  if (!r.enabled) {
    return asToast("Session compression not enabled（Habitat 服务配置 → compression.enabled）");
  }

  if (r.error === "empty") {
    return asToast("⚠️ No conversation content to summarize.");
  }
  if (r.error === "in_progress") {
    return asToast("⚠️ Turn still in progress — wait for the assistant reply, then /summarize.");
  }
  if (r.error === "already_collapsed") {
    return asToast("ℹ️ Already fully summarized (l2 = l3 = l4).");
  }
  if (r.error === "summary_empty") {
    const runHint = r.summary_run_id ? `（auto-llm run: ${r.summary_run_id}）` : "";
    const detail = r.summary_error ? ` ${r.summary_error}` : "";
    return asPanel(
      [
        `⚠️ 摘要文本未写入会话${runHint}`,
        detail.trim() || "摘要 LLM 失败或空响应；可在 Habitat → Auto LLM runs 对照记录。",
        `l2: ${r.l2 ?? "—"}  l3: ${r.l3 ?? "—"}  l4: ${r.l4 ?? "—"}`,
      ].join("\n"),
    );
  }
  if (!r.ok) {
    return asToast(
      "⚠️ Could not summarize this conversation（compression 边界未持久化，请检查 Habitat 日志）。",
    );
  }

  const cfg = getCompressionConfig();
  const mode = r.idle ? "idle (l2=l3=l4)" : "partial (in-progress tail kept in raw)";
  const summaryPreview = (r.compression?.summary ?? "").trim();
  const preview =
    summaryPreview.length > 400 ? `${summaryPreview.slice(0, 400)}…` : summaryPreview || "(empty)";
  const headline = `✅ Summarized (${mode})`;
  const lines = [
    headline,
    `l2: ${r.l2 ?? "—"}  l3: ${r.l3 ?? "—"}  l4: ${r.l4 ?? "—"}`,
    "",
    "**Summary preview:**",
    preview,
    ...formatCompressionDiagnostics(r, cfg, { includeStorageSummary: true }),
  ];
  return asPanel(lines.join("\n"));
}

async function cmdCompress(ctx: CommandContext): Promise<CommandResult> {
  const force = ctx.args.includes("--force") || ctx.args.includes("-f");
  const r = (await conv().recompressConversation(ctx.conversationId, { force })) as Record<
    string,
    unknown
  > &
    CompressionAnalysis & { updated?: boolean };
  if (!r.enabled) {
    return asToast("Session compression not enabled（Habitat 服务配置 → compression.enabled）");
  }
  const cfg = getCompressionConfig();
  const lines = [
    r.updated ? "✅ Updated compression l2/l3" : "ℹ️ l2/l3 unchanged",
    `l2: ${r.l2 ?? "—"}  l3: ${r.l3 ?? "(none, below compression threshold)"}`,
    ...formatCompressionDiagnostics(r, cfg, { includeStorageSummary: true }),
  ];
  return asPanel(lines.join("\n"));
}

function cmdRestart(_ctx: CommandContext): CommandResult {
  if (getAppRuntime().isShuttingDown()) {
    return asToast("Service is already restarting…");
  }
  return {
    text: "🔄 Restarting service (waiting for in-flight conversations to flush)…",
    ux: "toast",
    data: { action: "restart" },
  };
}

function cmdUpgrade(_ctx: CommandContext): CommandResult {
  if (getAppRuntime().isShuttingDown()) {
    return asToast("Service is already restarting…");
  }
  const kind = getCliInstallKind();
  if (kind === "standalone") {
    return asPanel(
      "请在终端执行 `anima upgrade`（从 GitHub Releases 下载并覆盖独立安装前缀），完成后 `anima service restart`。",
    );
  }
  return asPanel(`⛔ ${CLI_UPGRADE_HINT_SOURCE}`);
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
    subcommands: [
      { name: "status", description: "View goal, subgoals, turn count, judge reason" },
      { name: "pause", description: "Pause auto-continue (state preserved)" },
      { name: "resume", description: "Resume a paused goal" },
      { name: "clear", description: "Clear the current goal" },
    ],
  });
  registerCommand({
    name: "subgoal",
    description: "Add or manage subgoals for the current conversation goal",
    handler: cmdSubgoal,
    scope: "conversation",
    subcommands: [
      { name: "remove", description: "Remove subgoal N (1-based): /subgoal remove <N>" },
      { name: "clear", description: "Clear all subgoals" },
    ],
  });
  registerCommand({
    name: "learn",
    description: "Force skill self-evolution review from this conversation",
    handler: cmdLearn,
    scope: "conversation",
  });
  registerCommand({
    name: "skills",
    description: "Skill library commands (curate / maintain)",
    handler: cmdSkills,
    scope: "conversation",
    subcommands: [{ name: "curate", description: "Run skill maintain bypass on the library" }],
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
    name: "summarize",
    description:
      "Manually collapse history into the runtime summary (idle: l2=l3=l4; waits for summary LLM)",
    handler: cmdSummarize,
    scope: "conversation",
  });
  registerCommand({
    name: "tooldisplay",
    description: "View or set gateway tool call display level for this conversation",
    handler: cmdToolDisplay,
    aliases: ["tool-display"],
    scope: "conversation",
    platforms: ["discord", "weixin"],
    subcommands: [
      { name: "reset", description: "Clear conversation override (use global default)" },
    ],
  });
  registerCommand({
    name: "restart",
    description: "Restart Free Anima service (waits for in-flight conversations to flush)",
    handler: cmdRestart,
    scope: "global",
    platforms: [CHAT_PLATFORM_PATTERN, "coding", "companion", "discord", "weixin"],
  });
  registerCommand({
    name: "upgrade",
    description: "Show how to upgrade (source / standalone; manual only)",
    handler: cmdUpgrade,
    scope: "global",
    platforms: [CHAT_PLATFORM_PATTERN, "coding", "companion", "discord", "weixin"],
  });
}
