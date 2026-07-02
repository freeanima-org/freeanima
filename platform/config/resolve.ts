import { credential } from "./credential.ts";
import { resolveVaultField } from "./vault-io.ts";

const ENV_FULL_RE = /^env\("([^"]*)"\)$/;
const VAULT_FULL_RE = /^vault\("(\d+)",\s*"([^"]*)"\)$/;
const CREDENTIAL_FULL_RE = /^credential\("([^"]*)",\s*"([^"]*)"\)$/;
const EMBEDDED_RE =
  /env\("([^"]*)"\)|vault\("(\d+)",\s*"([^"]*)"\)|credential\("([^"]*)",\s*"([^"]*)"\)/g;

const legacyCredentialRefs = new Set<string>();
let legacyCredentialWarned = false;

function resolveEnvKey(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

function warnLegacyCredential(ref: string): void {
  legacyCredentialRefs.add(ref);
  if (legacyCredentialWarned) return;
  legacyCredentialWarned = true;
  console.warn(
    '[freeanima] config 仍使用 credential()（pass 遗留）；请迁移到 vault("item_id", "field") 或 env("KEY")，见 Shell /vault',
  );
}

function resolveLegacyCredential(path: string, field: string, context: string): string {
  const ref = `credential("${path}", "${field}")`;
  warnLegacyCredential(ref);
  try {
    return credential(path, field);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `${msg} (${context}) — migrate to vault("item_id", "field") or env("KEY") via Shell /vault`,
      { cause: err },
    );
  }
}

/** @internal test reset */
export function resetLegacyCredentialWarningsForTest(): void {
  legacyCredentialRefs.clear();
  legacyCredentialWarned = false;
}

/** @internal test introspection */
export function legacyCredentialRefsForTest(): ReadonlySet<string> {
  return legacyCredentialRefs;
}

/**
 * 解析 config 中的引用（同步路径）：
 * - vault("id", "field") 不支持（请用 resolveValue）
 * - credential() 遗留 pass 回退（弃用）
 * - 明文（原样返回）
 */
export function resolveCredentialRef(value: string, _defaultField: string): string {
  const trimmed = value.trim();
  const credFull = CREDENTIAL_FULL_RE.exec(trimmed);
  if (credFull) {
    const credPath = credFull[1];
    const credField = credFull[2];
    if (credPath === undefined || credField === undefined) {
      throw new Error(`Invalid credential reference: ${trimmed}`);
    }
    return resolveLegacyCredential(credPath, credField, "resolveCredentialRef");
  }
  if (VAULT_FULL_RE.test(trimmed)) {
    throw new Error('Use resolveValue() for vault("item_id", "field") references');
  }
  return trimmed;
}

/** Lazily expand env("KEY") / vault("id", "field") / credential() references in config */
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
    const credPath = credFull[1];
    const credField = credFull[2];
    if (credPath === undefined || credField === undefined) {
      throw new Error(`Invalid credential reference: ${value}`);
    }
    return resolveLegacyCredential(credPath, credField, "resolveValue");
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
      if (credPath === undefined || credField === undefined) {
        throw new Error(`Invalid embedded credential reference in: ${value}`);
      }
      result += resolveLegacyCredential(credPath, credField, "embedded resolveValue");
    }
    lastIndex = match.index + match[0].length;
  }
  result += value.slice(lastIndex);
  return result;
}
