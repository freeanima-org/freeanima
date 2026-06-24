import type { AnimaConfig } from "@freeanima/core/config";

/** Sanitize entire value when key name matches (case-insensitive) */
const SECRET_KEY_PATTERN =
  /(?:^|_)(api[_-]?key|token|secret|password|pushkey|push_key|auth|credential)(?:$|_)/i;

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

function redactConnectionUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    if (u.username && u.protocol.startsWith("postgres")) u.username = u.username ? "***" : "";
    return u.toString();
  } catch {
    return "***";
  }
}

function sanitizeRecord(obj: Record<string, unknown>, parentKey = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;

    if (key === "env" && value !== null && typeof value === "object" && !Array.isArray(value)) {
      const envKeys = Object.keys(value as Record<string, unknown>);
      if (envKeys.length > 0) out.env_keys = envKeys;
      continue;
    }

    if (isSecretKey(key)) {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        out[key] = sanitizeRecord(value as Record<string, unknown>, key);
        continue;
      }
      out[key] = typeof value === "string" && value.length > 0 ? "***" : value;
      continue;
    }

    if (key === "url" && parentKey === "database" && typeof value === "string") {
      out[key] = redactConnectionUrl(value);
      continue;
    }

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out[key] = sanitizeRecord(value as Record<string, unknown>, key);
      continue;
    }

    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? sanitizeRecord(item as Record<string, unknown>, key)
          : item,
      );
      continue;
    }

    out[key] = value;
  }

  return out;
}

/** Runtime config snapshot for HTTP / Admin display (secrets sanitized) */
export function sanitizeConfigForApi(cfg: AnimaConfig): Record<string, unknown> {
  return sanitizeRecord(cfg as Record<string, unknown>);
}
