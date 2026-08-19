/** ISO-8601 date/time strings from JSON.stringify(Date). */
const ISO_DATE_STRING_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

/** Known timestamp column / field names revived at the JSON boundary. */
export const DATE_JSON_KEYS = new Set([
  "created_at",
  "updated_at",
  "read_at",
  "last_run_at",
  "finished_at",
  "started_at",
  "archived_at",
  "pinned_at",
  "observed_at",
  "timestamp",
  "last_used_at",
  "expires_at",
  "revoked_at",
]);

export function isPlainIsoDateString(value: string): boolean {
  if (!ISO_DATE_STRING_RE.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

/** Recursively revive ISO date strings under known keys (and nested objects) to `Date`. */
export function reviveDates<T>(value: T): T {
  if (value == null) {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => reviveDates(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" && DATE_JSON_KEYS.has(key) && isPlainIsoDateString(raw)) {
      out[key] = new Date(raw);
    } else if (raw != null && typeof raw === "object") {
      out[key] = reviveDates(raw);
    } else {
      out[key] = raw;
    }
  }
  return out as T;
}
