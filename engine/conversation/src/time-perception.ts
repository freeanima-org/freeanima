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

import {
  isUserMessage,
  type SessionMessage,
  type UserMessage,
} from "@freeanima/engine-conversation";

const CHINESE_WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 展示用固定时区：与 session timestamp 的 +08:00 约定一致 */
const DISPLAY_TZ = "Asia/Shanghai";

function calendarDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function weekdayIndexInTz(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TZ,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

function datePartsInTz(date: Date): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
} {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: DISPLAY_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
  };
}

export type TimePerceptionConfig = {
  /** 全局开关 */
  enabled: boolean;
  /** 最短间隔（分钟），小于此值不注入时间戳 */
  minGapMinutes: number;
  /** 每天第一条的完整格式（默认 YYYY-MM-DD 周X HH:MM） */
  fullDateFormat?: "default";
  /** 后续消息的时间格式（默认 HH:MM） */
  shortFormat?: "default";
};

const DEFAULT_CONFIG: TimePerceptionConfig = {
  enabled: true,
  minGapMinutes: 10,
};

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

/** 格式化 HH:MM（Asia/Shanghai） */
function formatTime(date: Date): string {
  const { hour, minute } = datePartsInTz(date);
  return `${hour}:${minute}`;
}

/** 格式化完整日期 + 中文星期 + 时间：`2026-05-20 周三 08:02` */
function formatFullDate(date: Date): string {
  const { year, month, day } = datePartsInTz(date);
  const w = CHINESE_WEEKDAYS[weekdayIndexInTz(date)];
  const t = formatTime(date);
  return `${year}-${month}-${day} 周${w} ${t}`;
}

/** 两个日期是否在不同日历日（按 Asia/Shanghai 比较） */
function isDifferentDay(a: Date, b: Date): boolean {
  return calendarDateKey(a) !== calendarDateKey(b);
}

/**
 * 向消息列表中的 user 消息注入时间前缀。
 *
 * 规则：
 * 1. 第一条 user 消息 → 完整日期 `[2026-05-20 周四 08:02]`
 * 2. 跨天后的第一条 user 消息 → 完整日期
 * 3. 同一天内，距上条 user ≥ minGapMinutes → `[HH:MM]`
 * 4. 同一天内，距上条 user < minGapMinutes → 不加前缀（时间连续性自然可知）
 * 5. 无 timestamp 或非 user 消息 → 跳过
 *
 * 纯函数，不修改输入。
 */
export function injectTimePrefixes(
  messages: SessionMessage[],
  config?: Partial<TimePerceptionConfig>,
): SessionMessage[] {
  const cfg: TimePerceptionConfig = { ...DEFAULT_CONFIG, ...config };
  if (!cfg.enabled) return messages;

  const result: SessionMessage[] = [];
  let lastUserDate: Date | null = null;
  let sawFirstUser = false;

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

    let prefix = "";

    if (!sawFirstUser) {
      prefix = formatFullDate(ts);
      sawFirstUser = true;
    } else if (lastUserDate && isDifferentDay(lastUserDate, ts)) {
      prefix = formatFullDate(ts);
    } else if (lastUserDate) {
      const gapMs = ts.getTime() - lastUserDate.getTime();
      const gapMinutes = gapMs / 60_000;
      if (gapMinutes >= cfg.minGapMinutes) {
        prefix = formatTime(ts);
      }
    }

    if (prefix) {
      const modified: UserMessage = {
        ...msg,
        content: `[${prefix}] ${msg.content}`,
      };
      result.push(modified);
    } else {
      result.push(msg);
    }

    lastUserDate = ts;
  }

  return result;
}
