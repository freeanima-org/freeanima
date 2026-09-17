import { setHostTimeZoneProvider, getConfiguredHostTimeZone } from "@freeanima/shared/util/time.ts";

/** Host 时区（IANA）；locale 已移除，文案直接用中文常量 */
const DEFAULT_TIMEZONE = "Asia/Shanghai";

let activeTimezone = DEFAULT_TIMEZONE;

/** 从全局配置应用 timezone；未配置时保持 Asia/Shanghai */
export function applyHostI18nConfig(opts: { timezone?: string | undefined }): void {
  if (opts.timezone && opts.timezone.trim()) {
    activeTimezone = opts.timezone.trim();
  } else {
    activeTimezone = DEFAULT_TIMEZONE;
  }
  setHostTimeZoneProvider(() => activeTimezone);
}

export function getHostTimezone(): string {
  return activeTimezone || getConfiguredHostTimeZone();
}

/** @internal 测试重置 */
export function resetHostI18nForTests(): void {
  activeTimezone = DEFAULT_TIMEZONE;
  setHostTimeZoneProvider(() => activeTimezone);
}

// 模块加载即接通默认 provider，避免业务在 boot 前读到错误默认
setHostTimeZoneProvider(() => activeTimezone);
