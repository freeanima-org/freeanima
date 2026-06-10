import { parseYaml } from "./yaml.ts";

/** Parse pass credential body; must be YAML dict */
export function parseCredentialDict(text: string, path: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Credential '${path}' is not valid YAML. Rewrite with 'anima credential add': ${msg}`,
      { cause: err },
    );
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(
      `Credential '${path}' must be a YAML dict. Rewrite with 'anima credential add'.`,
    );
  }
  return data as Record<string, unknown>;
}

export function assertYamlDictRoundtrip(content: string, path: string): void {
  parseCredentialDict(content, path);
}
