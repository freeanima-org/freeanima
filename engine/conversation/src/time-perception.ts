/**
 * 时间感知模块
 *
 * 数字生命没有内在时间流逝感知。这个模块在压缩层之后、LLM 推理之前
 * 给 user 消息注入时间前缀，让数字生命能感知消息在时间线中的位置。
 *
 * 设计原则：
 * - 不给数字生命虚假的内置感知
 * - 给它一块手表
 * - 不污染持久化数据（只改运行时副本）
 * - 不破坏缓存（时间戳是历史固定值）
 */

import { formatCstIso } from "@freeanima/kernel-util";
import { isUserMessage, type SessionMessage, type UserMessage } from "./message.ts";

const CST_DATETIME_MINUTE_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/;

/**
 * 从 user 消息中提取 timestamp。
 * JSONL 中的 timestamp 格式为 ISO 8601 +08:00，如 "2026-05-20T08:02:00.000+08:00"。
 * 无有效 timestamp 返回 null。
 */
function getMessageTimestamp(msg: UserMessage): Date | null {
  const ts = msg.timestamp;
  if (!ts || typeof ts !== "string") return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** CST（+08:00）下的 `YYYY-MM-DDTHH:mm` */
function formatCstDateTimeMinute(date: Date): string | null {
  const match = CST_DATETIME_MINUTE_RE.exec(formatCstIso(date));
  return match?.[1] ?? null;
}

/** 独占一行的 time 前缀，如 `time: 2026-06-07T17:45\n` */
function buildTimePrefixLine(date: Date): string | null {
  const dt = formatCstDateTimeMinute(date);
  if (!dt) return null;
  return `time: ${dt}\n`;
}

/**
 * 向消息列表中的 user 消息注入时间前缀。
 *
 * 规则：
 * 1. 每条有有效 timestamp 的 user 消息 → `time: YYYY-MM-DDTHH:mm\n` + 原文
 * 2. 无 timestamp 或非 user 消息 → 跳过
 *
 * 纯函数，不修改输入。
 */
export function injectTimePrefixes(messages: SessionMessage[]): SessionMessage[] {
  const result: SessionMessage[] = [];

  for (const msg of messages) {
    if (!isUserMessage(msg)) {
      result.push(msg);
      continue;
    }

    const ts = getMessageTimestamp(msg);
    if (!ts) {
      result.push(msg);
      continue;
    }

    const prefixLine = buildTimePrefixLine(ts);
    if (!prefixLine) {
      result.push(msg);
      continue;
    }

    const modified: UserMessage = {
      ...msg,
      content: `${prefixLine}${msg.content}`,
    };
    result.push(modified);
  }

  return result;
}
