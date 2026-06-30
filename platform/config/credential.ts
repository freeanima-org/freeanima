import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { assertYamlDictRoundtrip, parseCredentialDict } from "./credential-parse.ts";
import { stringifyYaml } from "./yaml.ts";
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

function toRuntimeError(err: unknown): RuntimeError {
  const msg = err instanceof Error ? err.message : String(err);
  return new RuntimeError(msg);
}

function resolveCredential(path: string, field: string): string {
  const raw = passShow(path);
  let dict: Record<string, unknown>;
  try {
    dict = parseCredentialDict(raw, path);
  } catch (err: unknown) {
    throw toRuntimeError(err);
  }

  const val = dict[field];
  if (val === undefined) {
    throw new RuntimeError(
      `Credential '${path}' has no field '${field}'. Available: ${Object.keys(dict).join(", ")}`,
    );
  }
  return String(val);
}

/** Read full YAML credential (for multi-field configs like weixin-ilink) */
export function credentialRaw(path: string): Record<string, unknown> {
  const raw = passShow(path);
  try {
    return parseCredentialDict(raw, path);
  } catch (err: unknown) {
    throw toRuntimeError(err);
  }
}

export function credential(path: string, field: string): string {
  const cacheKey = `${path}:${field}`;
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
  const name = parts.at(-1) ?? rel;
  const label = name.replace(/[-_]/g, " ");
  let fields: string[] = [];
  let tags: string[] = [];
  let desc = "";
  let isYaml = false;
  try {
    const raw = passShow(rel);
    const dict = parseCredentialDict(raw, rel);
    isYaml = true;
    fields = Object.keys(dict);
    const tagsRaw = dict.tags;
    if (Array.isArray(tagsRaw)) tags = tagsRaw.map(String);
    else if (typeof tagsRaw === "string")
      tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    desc = String(dict.desc ?? dict.description ?? "");
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

export type CredentialDetail =
  | { yaml: true; fields: Record<string, unknown> }
  | { yaml: false; value: string };

/** Read credential plaintext (only paths listed by listCredentials) */
export function getCredentialDetail(path: string): CredentialDetail {
  const meta = listCredentials().find((c) => c.path === path);
  if (!meta) {
    throw new RuntimeError(`Credential not found: ${path}`);
  }
  if (meta.yaml) {
    return { yaml: true, fields: credentialRaw(path) };
  }
  return { yaml: false, value: passShow(path) };
}

export function clearCredentialCache(): void {
  cache.clear();
}

function clearCredentialCacheForPath(path: string): void {
  for (const k of cache.keys()) {
    if (k === path || k.startsWith(`${path}:`)) cache.delete(k);
  }
}

function credentialNotFound(err: unknown): boolean {
  return err instanceof RuntimeError && err.message.startsWith("Failed to read credential");
}

/** Convert YAML dict to string record (for merge / pass write-back) */
export function credentialDictToRecord(dict: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(dict)) {
    if (val == null || val === undefined) continue;
    if (typeof val === "string") out[key] = val;
    else if (typeof val === "number" || typeof val === "boolean") out[key] = String(val);
    else out[key] = JSON.stringify(val);
  }
  return out;
}

/** Merge existing fields with patch (patch overwrites same keys) */
export function mergeCredentialData(
  existing: Record<string, unknown>,
  patch: Record<string, string>,
): Record<string, string> {
  return { ...credentialDictToRecord(existing), ...patch };
}

function writeCredential(path: string, content: string): string {
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

/** Write or overwrite pass credential (YAML dict) */
export function insertCredential(path: string, data: Record<string, string>): string {
  const content = stringifyYaml(data);
  try {
    assertYamlDictRoundtrip(content, path);
  } catch (err: unknown) {
    throw toRuntimeError(err);
  }
  return writeCredential(path, content);
}

/** Merge-update pass credential fields; same as insertCredential if path missing */
export function updateCredential(path: string, patch: Record<string, string>): string {
  let merged: Record<string, string>;
  try {
    const raw = passShow(path);
    const dict = parseCredentialDict(raw, path);
    merged = mergeCredentialData(dict, patch);
  } catch (err: unknown) {
    if (credentialNotFound(err)) {
      merged = patch;
    } else {
      throw toRuntimeError(err);
    }
  }
  return insertCredential(path, merged);
}
