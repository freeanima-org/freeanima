import { credential } from "./credential.ts";

const ENV_FULL_RE = /^env\("([^"]*)"\)$/;
const CREDENTIAL_FULL_RE = /^credential\("([^"]*)",\s*"([^"]*)"\)$/;
const EMBEDDED_RE = /env\("([^"]*)"\)|credential\("([^"]*)",\s*"([^"]*)"\)/g;

function resolveEnvKey(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`环境变量 ${key} 未设置`);
  }
  return value;
}

function resolveCredential(path: string, field: string): string {
  return credential(path, field);
}

/** 延迟展开 config 中的 env("KEY") / credential("path", "field") 引用 */
export async function resolveValue(value: string): Promise<string> {
  const envFull = ENV_FULL_RE.exec(value);
  if (envFull) {
    return resolveEnvKey(envFull[1]!);
  }

  const credFull = CREDENTIAL_FULL_RE.exec(value);
  if (credFull) {
    return resolveCredential(credFull[1]!, credFull[2]!);
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
    } else {
      result += resolveCredential(match[2]!, match[3]!);
    }
    lastIndex = match.index + match[0].length;
  }
  result += value.slice(lastIndex);
  return result;
}
