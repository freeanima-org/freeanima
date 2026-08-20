/** LoCoMo 评测默认连接（compose.yaml）；勿指向日常 5432/6379 */
export const LOCOMO_DEFAULT_PG_URL = "postgres://locomo:locomo@127.0.0.1:55432/locomo";
export const LOCOMO_DEFAULT_REDIS_URL = "redis://127.0.0.1:56379/0";

export function resolveLocomoPgUrl(): string {
  return (
    process.env.LOCOMO_PG_URL?.trim() ||
    process.env.ANIMA_TEST_PG_URL?.trim() ||
    LOCOMO_DEFAULT_PG_URL
  );
}

export function resolveLocomoRedisUrl(): string {
  return process.env.LOCOMO_REDIS_URL?.trim() || LOCOMO_DEFAULT_REDIS_URL;
}

export function resolveLocomoApiKey(): string | undefined {
  return process.env.LOCOMO_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || undefined;
}

/** OpenCode Go 默认网关（与 `opencode_go` preset 一致） */
export const LOCOMO_DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1";

/** 经 OpenCode Go 的默认模型（openai_compatible；可用 LOCOMO_MODEL / --model 覆盖） */
export const LOCOMO_DEFAULT_MODEL = "deepseek-v4-flash";

export function resolveLocomoBaseUrl(): string {
  return (
    process.env.LOCOMO_BASE_URL?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    LOCOMO_DEFAULT_BASE_URL
  ).replace(/\/$/, "");
}

export function resolveLocomoModel(): string {
  return process.env.LOCOMO_MODEL?.trim() || LOCOMO_DEFAULT_MODEL;
}
