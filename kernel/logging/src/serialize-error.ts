export function serializeError(err: unknown): unknown {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
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
