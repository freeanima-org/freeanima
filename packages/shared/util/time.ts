/** Host IANA timezone provider（Habitat boot / 测试注入）；默认 Asia/Shanghai */
export type HostTimeZoneProvider = () => string;

const DEFAULT_HOST_TIMEZONE = "Asia/Shanghai";

let hostTimeZoneProvider: HostTimeZoneProvider = () => DEFAULT_HOST_TIMEZONE;

/** 注入宿主机时区（由 `applyHostI18nConfig` / 测试调用） */
export function setHostTimeZoneProvider(provider: HostTimeZoneProvider): void {
  hostTimeZoneProvider = provider;
}

export function getConfiguredHostTimeZone(): string {
  const tz = hostTimeZoneProvider()?.trim();
  return tz && tz.length > 0 ? tz : DEFAULT_HOST_TIMEZONE;
}

/** @internal 测试重置 */
export function resetHostTimeZoneProviderForTests(): void {
  hostTimeZoneProvider = () => DEFAULT_HOST_TIMEZONE;
}

/** Millisecond offset of a timezone from UTC at a given instant */
export function timeZoneOffsetMs(timeZone: string, date: Date = new Date()): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "numeric",
    });
    const parts = dtf.formatToParts(date);
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    // GMT+8 / GMT+08:00 / UTC / GMT
    if (name === "GMT" || name === "UTC") return 0;
    const m = /(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/.exec(name);
    if (!m) {
      // Fallback: compare local wall in TZ vs UTC
      return legacyOffsetFromParts(timeZone, date);
    }
    const sign = m[1] === "-" ? -1 : 1;
    const hours = Number(m[2]);
    const mins = Number(m[3] ?? "0");
    return sign * (hours * 60 + mins) * 60 * 1000;
  } catch {
    return CST_OFFSET_MS;
  }
}

function legacyOffsetFromParts(timeZone: string, date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

function formatOffsetIso(offsetMs: number): string {
  const sign = offsetMs >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMs);
  const hours = Math.floor(abs / 3_600_000);
  const mins = Math.floor((abs % 3_600_000) / 60_000);
  return `${sign}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Millisecond offset of CST (+8) from UTC — 兼容别名；新代码用 {@link timeZoneOffsetMs} */
export const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * 当前瞬间按 host 时区格式化为带 offset 的 ISO 8601。
 * 名称保留 formatCstIso 兼容；实现已按 `i18n.timezone` 输出。
 */
export function formatCstIso(date: Date = new Date()): string {
  const tz = getConfiguredHostTimeZone();
  const offsetMs = timeZoneOffsetMs(tz, date);
  const shifted = new Date(date.getTime() + offsetMs);
  return shifted.toISOString().replace("Z", formatOffsetIso(offsetMs));
}

/** Unix epoch seconds → host-TZ ISO string truncated to minute precision (no subseconds) */
export function formatCstIsoFromEpoch(epochSec: number): string {
  if (epochSec <= 0) return "";
  return formatCstIso(new Date(epochSec * 1000)).slice(0, 19);
}

export type FormatCstDisplayOpts = {
  /** Include seconds (default: minute precision only) */
  seconds?: boolean;
};

const CST_ISO_PARTS_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

function formatCstIsoParts(iso: string, opts?: FormatCstDisplayOpts): string {
  const match = CST_ISO_PARTS_RE.exec(iso);
  if (!match) return "";
  const [, y, mo, d, h, mi, s] = match;
  const datePart = `${y}/${mo}/${d}`;
  if (opts?.seconds) return `${datePart} ${h}:${mi}:${s ?? "00"}`;
  return `${datePart} ${h}:${mi}`;
}

function parseToDate(input: string | Date | number): Date | null {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input <= 0) return null;
    const ms = input > 1e12 ? input : input * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const trimmed = input.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Human-readable host-TZ display: `YYYY/MM/DD HH:MM` or with seconds */
export function formatCstDisplay(
  input: string | Date | number | null | undefined,
  opts?: FormatCstDisplayOpts,
): string {
  if (input == null || input === "") return "";
  const date = parseToDate(input);
  if (!date) return typeof input === "string" ? input : "";
  return formatCstIsoParts(formatCstIso(date), opts);
}

/** Unix epoch seconds → display string */
export function formatCstDisplayFromEpoch(epochSec: number, opts?: FormatCstDisplayOpts): string {
  if (epochSec <= 0) return "";
  return formatCstDisplay(epochSec, opts);
}

/** Unix epoch milliseconds → display string */
export function formatCstDisplayFromMs(epochMs: number, opts?: FormatCstDisplayOpts): string {
  if (epochMs <= 0) return "";
  return formatCstDisplay(epochMs, opts);
}

const CST_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar weekday in Chinese for host TZ, e.g. `周三` */
export function formatCstWeekdayZh(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: getConfiguredHostTimeZone(),
    weekday: "short",
  }).format(date);
}

/** Whether a YYYY-MM-DD calendar day is Monday in host TZ */
export function isCstMonday(day: string): boolean {
  const match = CST_DAY_RE.exec(day.trim());
  if (!match) return false;
  const tz = getConfiguredHostTimeZone();
  const offset = formatOffsetIso(timeZoneOffsetMs(tz, new Date(`${match[0]}T12:00:00Z`)));
  const noon = new Date(`${match[0]}T12:00:00${offset}`);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(noon);
  return weekday === "Mon";
}

/** IANA id for SQL `AT TIME ZONE` / Intl（默认 Asia/Shanghai） */
export function hostTimeZoneId(): string {
  return getConfiguredHostTimeZone();
}
