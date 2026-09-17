export type VoiceIntentKind = "reminder" | "task" | "diary" | "pomodoro" | "unknown";

export type ParsedVoiceIntent =
  | {
      kind: "reminder";
      title: string;
      remind_at: string;
    }
  | {
      kind: "task";
      title: string;
    }
  | {
      kind: "diary";
      content: string;
    }
  | {
      kind: "pomodoro";
    }
  | {
      kind: "unknown";
      raw: string;
    };

const WAKE_PHRASE_PATTERN = /^(小风|小峰)[，,、\s]*/;

function stripWakePhrase(text: string): string {
  return text.replace(WAKE_PHRASE_PATTERN, "").trim();
}

function cnDigitToNumber(token: string): number | null {
  const map: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  if (/^\d+$/.test(token)) {
    const n = Number(token);
    return Number.isInteger(n) ? n : null;
  }
  if (token === "十") return 10;
  if (token.startsWith("十") && token.length === 2) {
    const tail = map[token.charAt(1)];
    return tail != null ? 10 + tail : null;
  }
  if (token.endsWith("十") && token.length === 2) {
    const head = map[token.charAt(0)];
    return head != null ? head * 10 : null;
  }
  if (token.length === 3 && token.charAt(1) === "十") {
    const head = map[token.charAt(0)];
    const tail = map[token.charAt(2)];
    if (head != null && tail != null) return head * 10 + tail;
  }
  return map[token] ?? null;
}

function parseHourMinute(raw: string): { hour: number; minute: number } | null {
  const cn =
    raw.match(/([零一二两三四五六七八九十]{1,3})\s*点(?:半|([零一二两三四五六七八九十]+)分?)?/) ??
    raw.match(/([零一二两三四五六七八九十]{1,3})\s*[点时:：]\s*([零一二两三四五六七八九十]+)?/);
  if (cn) {
    const hourToken = cn[1];
    if (!hourToken) return null;
    const hour = cnDigitToNumber(hourToken);
    if (hour == null || hour < 0 || hour > 23) return null;
    let minute = 0;
    if (cn[0]?.includes("半")) minute = 30;
    else if (cn[2]) {
      const m = cnDigitToNumber(cn[2]);
      if (m == null || m < 0 || m > 59) return null;
      minute = m;
    }
    return { hour, minute };
  }

  const m =
    raw.match(/(\d{1,2})\s*[点时:：]\s*(\d{1,2})?/) ??
    raw.match(/(\d{1,2})\s*点半/) ??
    raw.match(/(\d{1,2})\s*点/);
  if (!m) return null;
  const hour = Number(m[1]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  let minute = 0;
  if (m[0]?.includes("半")) {
    minute = 30;
  } else if (m[2] != null && m[2] !== "") {
    minute = Number(m[2]);
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function applyDayPart(hour: number, text: string): number {
  if (/下午|晚上|傍晚/.test(text) && hour >= 1 && hour <= 11) return hour + 12;
  if (/中午/.test(text) && hour >= 1 && hour <= 10) return hour + 12;
  if (/早上|上午|清晨|凌晨/.test(text) && hour === 12) return 0;
  return hour;
}

function resolveRemindAt(text: string, now = new Date()): string | null {
  const hm = parseHourMinute(text);
  if (!hm) return null;
  const target = new Date(now);
  if (/明天/.test(text)) target.setDate(target.getDate() + 1);
  else if (/后天/.test(text)) target.setDate(target.getDate() + 2);
  else if (/大后天/.test(text)) target.setDate(target.getDate() + 3);
  const hour = applyDayPart(hm.hour, text);
  target.setHours(hour, hm.minute, 0, 0);
  if (target.getTime() <= now.getTime() && !/明天|后天|大后天/.test(text)) {
    target.setDate(target.getDate() + 1);
  }
  return target.toISOString();
}

function extractAfterPatterns(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return m[1].trim();
  }
  return text.trim();
}

export function parseVoiceIntent(rawInput: string, now = new Date()): ParsedVoiceIntent {
  const text = stripWakePhrase(rawInput.replace(/\s+/g, " ").trim());
  if (!text) return { kind: "unknown", raw: rawInput };

  if (/^(开始|启动|打开)?(番茄|专注|番茄钟)/.test(text)) {
    return { kind: "pomodoro" };
  }

  if (/写日记|记日记|日记[:：]/.test(text)) {
    const content = extractAfterPatterns(text, [
      /写日记[:：]?\s*(.+)$/,
      /记日记[:：]?\s*(.+)$/,
      /日记[:：]\s*(.+)$/,
    ]);
    if (content) return { kind: "diary", content };
  }

  if (/定闹钟|闹钟|提醒我|提醒一下|设置提醒/.test(text)) {
    const remindAt = resolveRemindAt(text, now);
    const title = extractAfterPatterns(text, [
      /提醒我\s*(.+)$/,
      /提醒一下\s*(.+)$/,
      /定闹钟\s*(.+)$/,
      /设置提醒\s*(.+)$/,
    ])
      .replace(/明天|后天|大后天|早上|上午|下午|晚上|中午|\d{1,2}[点时:：]\d{0,2}|半/g, "")
      .replace(/[，,。.!！?？]/g, "")
      .trim();
    if (remindAt && title) {
      return { kind: "reminder", title, remind_at: remindAt };
    }
  }

  if (/添加任务|新建任务|创建任务|加个任务|加任务/.test(text)) {
    const title = extractAfterPatterns(text, [
      /添加任务[:：]?\s*(.+)$/,
      /新建任务[:：]?\s*(.+)$/,
      /创建任务[:：]?\s*(.+)$/,
      /加个任务[:：]?\s*(.+)$/,
      /加任务[:：]?\s*(.+)$/,
    ]);
    if (title) return { kind: "task", title };
  }

  return { kind: "unknown", raw: text };
}
