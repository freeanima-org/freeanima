/** unknown → 普通对象的运行时窄化（type predicate，无 `as`） */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function assertRecord(
  value: unknown,
  label = "value",
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

/** 软失败：非对象返回 null */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}
