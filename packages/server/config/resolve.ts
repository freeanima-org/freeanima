import { resolveVaultField } from "./vault-io.ts";

const ENV_FULL_RE = /^env\("([^"]*)"\)$/;
const VAULT_FULL_RE = /^vault\("(\d+)",\s*"([^"]*)"\)$/;
const CREDENTIAL_FULL_RE = /^credential\("([^"]*)",\s*"([^"]*)"\)$/;
const EMBEDDED_RE =
  /env\("([^"]*)"\)|vault\("(\d+)",\s*"([^"]*)"\)|credential\("([^"]*)",\s*"([^"]*)"\)/g;

const LEGACY_CREDENTIAL_HINT =
  'credential() 已移除；请迁移到 vault("item_id", "field") 或 env("KEY")（Shell /vault）';

function resolveEnvKey(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

function rejectLegacyCredential(context: string, ref?: string): never {
  throw new Error(
    ref
      ? `${context}: ${LEGACY_CREDENTIAL_HINT} — ${ref}`
      : `${context}: ${LEGACY_CREDENTIAL_HINT}`,
  );
}

/**
 * 解析 config 中的引用（同步路径）：
 * - vault("id", "field") 不支持（请用 resolveValue）
 * - credential() 已移除
 * - 明文（原样返回）
 */
export function resolveCredentialRef(value: string, _defaultField: string): string {
  const trimmed = value.trim();
  const credFull = CREDENTIAL_FULL_RE.exec(trimmed);
  if (credFull) {
    rejectLegacyCredential("resolveCredentialRef", trimmed);
  }
  if (VAULT_FULL_RE.test(trimmed)) {
    throw new Error('Use resolveValue() for vault("item_id", "field") references');
  }
  return trimmed;
}

/** Lazily expand env("KEY") / vault("id", "field") references in config */
export async function resolveValue(value: string): Promise<string> {
  const envFull = ENV_FULL_RE.exec(value);
  if (envFull) {
    const envKey = envFull[1];
    if (envKey === undefined) {
      throw new Error(`Invalid env reference: ${value}`);
    }
    return resolveEnvKey(envKey);
  }

  const vaultFull = VAULT_FULL_RE.exec(value);
  if (vaultFull) {
    const itemId = Number(vaultFull[1]);
    const field = vaultFull[2];
    if (!Number.isFinite(itemId) || itemId <= 0 || !field) {
      throw new Error(`Invalid vault reference: ${value}`);
    }
    return resolveVaultField(itemId, field);
  }

  const credFull = CREDENTIAL_FULL_RE.exec(value);
  if (credFull) {
    rejectLegacyCredential("resolveValue", value);
  }

  EMBEDDED_RE.lastIndex = 0;
  if (!EMBEDDED_RE.test(value)) {
    return value;
  }

  let result = "";
  let lastIndex = 0;
  EMBEDDED_RE.lastIndex = 0;
  for (let match = EMBEDDED_RE.exec(value); match; match = EMBEDDED_RE.exec(value)) {
    result += value.slice(lastIndex, match.index);
    if (match[1] !== undefined) {
      result += resolveEnvKey(match[1]);
    } else if (match[2] !== undefined && match[3] !== undefined) {
      const itemId = Number(match[2]);
      const field = match[3];
      if (!Number.isFinite(itemId) || itemId <= 0) {
        throw new Error(`Invalid embedded vault reference in: ${value}`);
      }
      result += await resolveVaultField(itemId, field);
    } else {
      const credPath = match[4];
      const credField = match[5];
      const ref =
        credPath !== undefined && credField !== undefined
          ? `credential("${credPath}", "${credField}")`
          : value;
      rejectLegacyCredential("embedded resolveValue", ref);
    }
    lastIndex = match.index + match[0].length;
  }
  result += value.slice(lastIndex);
  return result;
}
