/** 将 unknown 收窄为可安全字符串化的标量；object 等非常量返回 fallback。 */
export function coerceString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "boolean":
    case "bigint":
      return String(value);
    default:
      return fallback;
  }
}

/** 仅当值为 string 时返回，否则 undefined。 */
export function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
