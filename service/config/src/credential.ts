import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as yamlStringify } from "yaml";
import { PATHS } from "./paths.ts";

export interface CredentialMeta {
  path: string;
  category: string;
  name: string;
  label: string;
  yaml: boolean;
  fields: string[];
  tags: string[];
  desc: string;
}

const cache = new Map<string, string | Error>();

function passShow(path: string): string {
  try {
    const out = execFileSync("pass", ["show", path], {
      encoding: "utf-8",
      timeout: 10_000,
    });
    const value = out.trim();
    if (!value) throw new RuntimeError(`Credential '${path}' is empty`);
    return value;
  } catch (err: unknown) {
    if (err instanceof Error && "status" in err) {
      throw new RuntimeError(`Failed to read credential '${path}': ${err.message}`);
    }
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new RuntimeError(
        "Credential store unavailable (pass CLI not found). Install pass: apt install pass",
      );
    }
    throw err;
  }
}

class RuntimeError extends Error {
  override name = "RuntimeError";
}

function tryYaml(text: string): { data: unknown; isYaml: boolean } {
  try {
    const data = parseYaml(text);
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      return { data, isYaml: true };
    }
    return { data: text, isYaml: false };
  } catch {
    return { data: text, isYaml: false };
  }
}

function resolveCredential(path: string, field?: string): string {
  const raw = passShow(path);
  const { data, isYaml } = tryYaml(raw);
  if (!isYaml) return String(data);
  const dict = data as Record<string, unknown>;
  if (field) {
    const val = dict[field];
    if (val === undefined) {
      throw new RuntimeError(
        `Credential '${path}' has no field '${field}'. Available: ${Object.keys(dict).join(", ")}`,
      );
    }
    return String(val);
  }
  throw new RuntimeError(
    `Credential '${path}' is a YAML dict with fields: ${Object.keys(dict).join(", ")}. Specify field=`,
  );
}

/** 读取 YAML 凭证全文（用于 weixin-ilink 等多字段配置） */
export function credentialRaw(path: string): Record<string, unknown> {
  const raw = passShow(path);
  const { data, isYaml } = tryYaml(raw);
  if (!isYaml || typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new RuntimeError(
      `Credential '${path}' is plaintext, not YAML. Use 'anima credential add' to rewrite as YAML.`,
    );
  }
  return data as Record<string, unknown>;
}

export function credential(path: string, field?: string): string {
  const cacheKey = field ? `${path}:${field}` : path;
  const hit = cache.get(cacheKey);
  if (hit !== undefined) {
    if (hit instanceof Error) throw hit;
    return hit;
  }
  try {
    const value = resolveCredential(path, field);
    cache.set(cacheKey, value);
    return value;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    cache.set(cacheKey, err);
    throw err;
  }
}

function walkGpg(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkGpg(full, acc);
    else if (name.endsWith(".gpg")) acc.push(full);
  }
  return acc;
}

function readCredentialMeta(gpgPath: string): CredentialMeta {
  const rel = gpgPath.slice(PATHS.passStore.length + 1).replace(/\.gpg$/, "");
  const parts = rel.split("/");
  const category = parts[0] ?? "";
  const name = parts[parts.length - 1] ?? rel;
  const label = name.replace(/[-_]/g, " ");
  let fields: string[] = [];
  let tags: string[] = [];
  let desc = "";
  let isYaml = false;
  try {
    const raw = passShow(rel);
    const { data, isYaml: y } = tryYaml(raw);
    isYaml = y;
    if (y && typeof data === "object" && data !== null) {
      const dict = data as Record<string, unknown>;
      fields = Object.keys(dict);
      const tagsRaw = dict.tags;
      if (Array.isArray(tagsRaw)) tags = tagsRaw.map(String);
      else if (typeof tagsRaw === "string")
        tags = tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      desc = String(dict.desc ?? dict.description ?? "");
    }
  } catch {
    // metadata only
  }
  return { path: rel, category, name, label, yaml: isYaml, fields, tags, desc };
}

export function listCredentials(): CredentialMeta[] {
  try {
    statSync(PATHS.passStore);
  } catch {
    return [];
  }
  return walkGpg(PATHS.passStore).toSorted().map(readCredentialMeta);
}

export function clearCredentialCache(): void {
  cache.clear();
}

function clearCredentialCacheForPath(path: string): void {
  for (const k of [...cache.keys()]) {
    if (k === path || k.startsWith(`${path}:`)) cache.delete(k);
  }
}

/** 写入或覆盖 pass 凭证（YAML 字典） */
export function insertCredential(path: string, data: Record<string, string>): string {
  const content = yamlStringify(data);
  let result: ReturnType<typeof spawnSync>;
  try {
    result = spawnSync("pass", ["insert", "--multiline", "--force", path], {
      input: `${content}\n`,
      encoding: "utf-8",
      timeout: 10_000,
    });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new RuntimeError(
        "Credential store unavailable (pass CLI not found). Install pass: apt install pass",
      );
    }
    throw err;
  }
  if (result.status !== 0) {
    const msg =
      String(result.stderr ?? "").trim() ||
      `credential store command failed (exit ${result.status})`;
    throw new RuntimeError(`Failed to write credential '${path}': ${msg}`);
  }
  clearCredentialCacheForPath(path);
  return path;
}
