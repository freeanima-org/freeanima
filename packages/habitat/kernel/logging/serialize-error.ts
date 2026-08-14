const MAX_ERROR_CAUSE_DEPTH = 5;

export function serializeError(err: unknown, depth = 0): unknown {
  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
    if (depth < MAX_ERROR_CAUSE_DEPTH && "cause" in err && err.cause !== undefined) {
      out.cause = serializeError(err.cause, depth + 1);
    }
    return out;
  }
  return err;
}

export function normalizeAttributes(attributes: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    normalized[key] = key === "err" ? serializeError(value) : value;
  }
  return normalized;
}
