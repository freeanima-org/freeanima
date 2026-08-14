export { normalizePgTimestamp } from "@freeanima/habitat/core/db/schema";

function emptyToNull<T>(value: T | null | undefined | ""): T | null {
  if (value === undefined || value == null || value === "") return null;
  return value;
}

export function pgTextOrNull(value: string | null | undefined): string | null {
  return emptyToNull(value);
}

export function pgJsonbOrNull<T>(value: T | null | undefined | ""): T | null {
  return emptyToNull(value);
}
