import {
  type CommandContext,
  type CommandResult,
  listCommandDefsForPlatform,
  registerCommand,
} from "./registry.ts";
import { clearAwaitingClarify, readAwaitingClarify } from "@freeanima/capabilities-clarify";
import {
  defaultMaskRegistry,
  getMask,
  listMasks,
  resolveMaskPresets,
} from "@freeanima/capabilities-mask";
import { defaultToolSetRegistry } from "@freeanima/engine-tool";
import { statsReport } from "@freeanima/service-api/conversation-stats";
import { PARLOR_PLATFORM } from "@freeanima/service-api/constants";
import { onSessionCloseBeforeNew } from "@freeanima/service-api/session-close";
import { listTools } from "@freeanima/engine-tool";
import { isSessionMeta } from "@freeanima/engine-db/domain";
import { setHomeChannel } from "@freeanima/service-api/home-channel";
import { getServiceContext } from "@freeanima/service-api";

function conv() {
  return getServiceContext().conversation;
}

function cmdHelp(ctx: CommandContext): string {
  const available = listCommandDefsForPlatform(ctx.platform);
  const sessionCmds = available.filter((c) => (c.scope ?? "session") === "session");
  const globalCmds = available.filter((c) => c.scope === "global");

  const lines = ["**可用命令：**"];
  if (sessionCmds.length) {
    lines.push("", "**当前 session：**");
    for (const cmd of sessionCmds) {
      lines.push(`  • \`/${cmd.name}\` — ${cmd.description}`);
    }
  }
  if (globalCmds.length) {
    lines.push("", "**其它：**");
    for (const cmd of globalCmds) {
      lines.push(`  • \`/${cmd.name}\` — ${cmd.description}`);
    }
  }
  return lines.join("\n");
}

async function cmdNew(ctx: CommandContext): Promise<CommandResult> {
  await onSessionCloseBeforeNew(ctx.sessionId);
  const sid = await conv().newSession(ctx.platform);
  return {
    text: `🆕 新 session 已创建（${sid.slice(0, 8)}...）`,
    data: { new_session_id: sid },
  };
}

function cmdRetry(_ctx: CommandContext): CommandResult {
  return { text: "", data: { action: "retry" } };
}

async function cmdCancel(ctx: CommandContext): Promise<string> {
  const pending = await readAwaitingClarify(conv(), ctx.sessionId);
  if (!pending) return "当前没有待回答的提问。";
  await clearAwaitingClarify(conv(), ctx.sessionId);
  return "已取消提问，可以继续对话。";
}

async function cmdReloadTools(ctx: CommandContext): Promise<string> {
  const meta = await conv().loadSessionMeta(ctx.sessionId);
  if (!isSessionMeta(meta)) {
    return "⚠️ 当前 session 不存在，无法更新工具列表。";
  }
  const before = meta.tools.length;
  try {
    const count = await conv().reloadSessionTools(ctx.sessionId);
    const names = listTools().map((t) => t.name);
    const preview = names.length <= 8 ? names.join(", ") : `${names.slice(0, 8).join(", ")}…`;
    return `✅ 已更新 session 工具列表：${count} 个（此前 ${before} 个）。下次对话将携带最新工具。\n${preview}`;
  } catch (e) {
    return `⚠️ 更新工具列表失败：${String(e)}`;
  }
}

async function cmdReloadSystemPrompt(ctx: CommandContext): Promise<string> {
  const meta = await conv().loadSessionMeta(ctx.sessionId);
  if (!isSessionMeta(meta)) {
    return "⚠️ 当前 session 不存在，无法重建 system prompt。";
  }
  await conv().rebuildSessionSystemPrompt(ctx.sessionId);
  const after = await conv().loadSessionMeta(ctx.sessionId);
  const sp = isSessionMeta(after) ? (after.system_prompt ?? "") : "";
  return `✅ 已重建 system prompt（${sp.length} 字符），仅更新 session_meta.system_prompt`;
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
    return `📁 当前工作目录: ${cwd ?? "（未设置）"}`;
  }
  const newCwd = ctx.args.join(" ");
  try {
    const resolved = await conv().setSessionCwd(ctx.sessionId, newCwd);
    return `✅ 工作目录已切换至: ${resolved}\n（如有 AGENTS.md，内容已注入 system prompt）`;
  } catch (e) {
    return `❌ ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function cmdTitle(ctx: CommandContext): Promise<string> {
  if (!ctx.args.length) {
    const title = await conv().getSessionTitle(ctx.sessionId);
    return `📝 当前标题: ${title || "（空）"}`;
  }
  const newTitle = ctx.args.join(" ").slice(0, 50);
  await conv().setSessionTitle(ctx.sessionId, newTitle);
  return `✅ 标题已更新: ${newTitle}`;
}

function cmdSethome(ctx: CommandContext): string {
  const extra = ctx.origin_extra;
  if (!extra) {
    return "⚠️ /sethome 仅能在 Discord 或微信聊天中使用。";
  }

  if (ctx.platform === "discord") {
    const channelId = String(extra.channel_id ?? "").trim();
    if (!channelId) {
      return "⚠️ 无法识别当前 Discord 频道。";
    }
    const threadId = String(extra.thread_id ?? "").trim();
    setHomeChannel("discord", channelId, threadId || undefined);
    const where = threadId ? `频道 ${channelId} / thread ${threadId}` : `频道 ${channelId}`;
    return `✅ 已将 Discord home channel 设为 ${where}（cron 投递等将默认发到这里）`;
  }

  if (ctx.platform === "weixin") {
    const peerId = String(extra.weixin_peer_id ?? "").trim();
    if (!peerId) {
      return "⚠️ 无法识别当前微信会话。";
    }
    setHomeChannel("weixin", peerId);
    return `✅ 已将微信 home channel 设为 ${peerId}（cron 投递等将默认发到这里）`;
  }

  return "⚠️ /sethome 仅能在 Discord 或微信聊天中使用。";
}

async function cmdCompress(ctx: CommandContext): Promise<string> {
  const force = ctx.args.includes("--force") || ctx.args.includes("-f");
  const r = await conv().recompressSession(ctx.sessionId, { force });
  if (!r.enabled) {
    return "会话压缩未启用（config.yaml → compression.enabled）";
  }
  const lines = [
    r.updated ? "✅ 已更新 compression l2/l3" : "ℹ️ l2/l3 未变化",
    `l2: ${r.l2 ?? "—"}  l3: ${r.l3 ?? "（无，未达压缩阈）"}`,
    `JSONL ${r.jsonl_total} 条 → 运行时 ${r.runtime_message_count} 条（隐藏 ${r.hidden_by_compression} 条）`,
    `原始段 ${r.window_raw}/${r.recompress_at} 条（首次阈 ${r.threshold}）`,
  ];
  if (r.messages_until_recompress != null) {
    lines.push(
      `距再次裁剪: 约 ${r.messages_until_recompress} 条（~${r.rounds_until_recompress} 轮）`,
    );
  }
  return lines.join("\n");
}

async function reloadMaskSideEffects(sessionId: string): Promise<void> {
  await conv().recompressSession(sessionId, { force: true });
  await conv().reloadSessionTools(sessionId);
  await conv().rebuildSessionSystemPrompt(sessionId);
}

async function cmdMask(ctx: CommandContext): Promise<string> {
  const sub = ctx.args[0]?.toLowerCase();
  const meta = await conv().loadSessionMeta(ctx.sessionId);
  if (!isSessionMeta(meta)) {
    return "⚠️ 当前 session 不存在，无法设置能力面罩。";
  }

  if (sub === "set") {
    const preset = ctx.args[1]?.trim();
    if (!preset) {
      return "用法：`/mask set <preset-name>`";
    }
    if (!getMask(preset)) {
      const known = listMasks()
        .map((m) => m.name)
        .join(", ");
      return `⚠️ 未知面具 '${preset}'。可用：${known || "（无）"}`;
    }
    await conv().updateSessionMetaField(ctx.sessionId, {
      capability_mask: { presets: [preset] },
    });
    await reloadMaskSideEffects(ctx.sessionId);
    const resolved = resolveMaskPresets([preset], defaultMaskRegistry, defaultToolSetRegistry);
    return `✅ 已设置能力面罩 '${preset}'（${resolved.allowed_tools.length} 个工具）。已压缩并重载工具与 system prompt。`;
  }

  if (sub === "clear") {
    await conv().updateSessionMetaField(ctx.sessionId, { capability_mask: undefined });
    await reloadMaskSideEffects(ctx.sessionId);
    return "✅ 已移除能力面罩，恢复全能力。已压缩并重载工具与 system prompt。";
  }

  if (sub === "show") {
    const presets = meta.capability_mask?.presets ?? [];
    if (!presets.length) {
      return "ℹ️ 当前 session 未设置能力面罩（全能力）。";
    }
    const resolved = resolveMaskPresets(presets, defaultMaskRegistry, defaultToolSetRegistry);
    const preview =
      resolved.allowed_tools.length <= 12
        ? resolved.allowed_tools.join(", ")
        : `${resolved.allowed_tools.slice(0, 12).join(", ")}…（共 ${resolved.allowed_tools.length} 个）`;
    return [`🎭 能力面罩：${presets.join(", ")}`, `允许工具：${preview || "（无）"}`].join("\n");
  }

  return "用法：`/mask set <preset>` | `/mask clear` | `/mask show`";
}

export function registerBuiltins(): void {
  registerCommand({
    name: "help",
    description: "列出所有可用命令",
    handler: cmdHelp,
    aliases: ["commands"],
    scope: "global",
  });
  registerCommand({
    name: "new",
    description: "创建新 session（旧 session 蒸馏并复盘）",
    handler: cmdNew,
    scope: "global",
    platforms: ["discord", "weixin"],
  });
  registerCommand({
    name: "retry",
    description: "重放最后一条伙伴消息并重新生成回复",
    handler: cmdRetry,
    aliases: ["regenerate"],
    scope: "session",
  });
  registerCommand({
    name: "cancel",
    description: "取消当前待回答的 clarify 提问",
    handler: cmdCancel,
    scope: "session",
  });
  registerCommand({
    name: "reload_tools",
    description: "将当前已注册工具写回 session_meta，下次对话请求时带给 LLM",
    handler: cmdReloadTools,
    aliases: ["reload-tools"],
    scope: "session",
  });
  registerCommand({
    name: "reload_system_prompt",
    description:
      "重建 system prompt（自我层、常驻记忆、session cwd 下 AGENTS.md），仅写回 system_prompt",
    handler: cmdReloadSystemPrompt,
    aliases: ["reload-system-prompt"],
    scope: "session",
  });
  registerCommand({
    name: "stats",
    description: "查看当前 session 对话消耗统计（--all 汇总全部 session）",
    handler: cmdStats,
    scope: "session",
  });
  registerCommand({
    name: "cwd",
    description: "查看或设置当前 session 工作目录",
    handler: cmdCwd,
    scope: "session",
  });
  registerCommand({
    name: "title",
    description: "查看或修改当前 session 标题",
    handler: cmdTitle,
    scope: "session",
  });
  registerCommand({
    name: "sethome",
    description: "将当前聊天设为该平台 home channel（cron 等主动通知的默认投递目标）",
    handler: cmdSethome,
    aliases: ["set-home"],
    scope: "global",
    platforms: ["discord", "weixin"],
  });
  registerCommand({
    name: "compress",
    description: "重新计算当前 session 运行时压缩（--force 忽略滞回）",
    handler: cmdCompress,
    scope: "session",
  });
  registerCommand({
    name: "mask",
    description: "设置 / 查看 / 清除当前 session 能力面罩（仅会客厅）",
    handler: cmdMask,
    scope: "session",
    platforms: [PARLOR_PLATFORM],
  });
}
