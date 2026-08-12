/**
 * User-message time perception prefix (runtime-only; not persisted).
 * Shape: `<time>YYYY-MM-DDTHH:mm 周X</time>\n` + original content.
 */

import { formatCstIso, formatCstWeekdayZh } from "@freeanima/host/core/util";
import { PROMPT_XML_TAGS, wrapPromptXml } from "./xml-wrap.ts";

const CST_DATETIME_MINUTE_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/;

/** Match injected time tag at start of user content (CST weekday optional for legacy-ish tolerance). */
export const USER_TIME_PREFIX_RE =
  /^<time>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?: 周[一二三四五六日])?<\/time>\n/;

/** `YYYY-MM-DDTHH:mm` in CST (+08:00) */
export function formatCstDateTimeMinute(date: Date): string | null {
  const match = CST_DATETIME_MINUTE_RE.exec(formatCstIso(date));
  return match?.[1] ?? null;
}

/** Standalone time prefix ending with newline, e.g. `<time>2026-06-07T17:45 周日</time>\n` */
export function buildUserTimePrefixLine(date: Date): string | null {
  const dt = formatCstDateTimeMinute(date);
  if (!dt) return null;
  const inner = `${dt} ${formatCstWeekdayZh(date)}`;
  const tag = wrapPromptXml(PROMPT_XML_TAGS.time, inner, { inline: true });
  if (!tag) return null;
  return `${tag}\n`;
}

export function stripUserTimePrefix(content: string): string {
  return content.replace(USER_TIME_PREFIX_RE, "").trim();
}
