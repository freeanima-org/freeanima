/** oxlint js 插件内本地收窄；勿依赖 @freeanima/shared path alias。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
