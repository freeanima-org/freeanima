/** Host 时区（IANA）；locale 已移除，文案直接用中文常量 */
let activeTimezone = "UTC";

/** 从全局配置应用 timezone */
export function applyHostI18nConfig(opts: { timezone?: string | undefined }): void {
  if (opts.timezone && opts.timezone.trim()) {
    activeTimezone = opts.timezone.trim();
  }
}

export function getHostTimezone(): string {
  return activeTimezone;
}

/** @internal 测试重置 */
export function resetHostI18nForTests(): void {
  activeTimezone = "UTC";
}
