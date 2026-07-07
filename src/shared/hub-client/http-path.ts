import type { HubHttpBinding } from "@freeanima/hub-contract";

/** 将 `{conversation_id}` 占位符替换为 input 字段 */
export function resolveHttpPath(template: string, input: Record<string, unknown>): string {
  return template.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = input[key];
    if (value === undefined || value === null) {
      throw new Error(`missing path param: ${key}`);
    }
    return encodeURIComponent(String(value));
  });
}

export function buildHttpUrl(
  origin: string,
  binding: HubHttpBinding,
  input: Record<string, unknown>,
): string {
  const base = origin.replace(/\/$/, "");
  const path = resolveHttpPath(binding.path, input);
  const url = new URL(`${base}${path}`);
  if (binding.method === "GET" || binding.method === "DELETE") {
    for (const [key, value] of Object.entries(input)) {
      if (path.includes(`{${key}}`)) continue;
      if (value === undefined || value === null) continue;
      if (typeof value === "object") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function bodyForHttpMethod(
  binding: HubHttpBinding,
  input: Record<string, unknown>,
): string | undefined {
  if (binding.method === "GET" || binding.method === "DELETE") return undefined;
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (binding.path.includes(`{${key}}`)) continue;
    if (value !== undefined) body[key] = value;
  }
  if (Object.keys(body).length === 0) return undefined;
  // config.patchSection 等 RPC 入参为 { section, patch }；REST body 应为 patch 本身
  const patch = body.patch;
  if (
    Object.keys(body).length === 1 &&
    patch != null &&
    typeof patch === "object" &&
    !Array.isArray(patch)
  ) {
    return JSON.stringify(patch);
  }
  return JSON.stringify(body);
}
