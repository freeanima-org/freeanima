export type ShellClientConfig = {
  habitatUrl: string;
  remoteAuthToken: string;
};

/** @deprecated 读兼容旧字段 hubUrl；0.9.3 可删 */
function readUrl(obj: Record<string, unknown>): string {
  if (typeof obj.habitatUrl === "string" && obj.habitatUrl.trim()) return obj.habitatUrl.trim();
  if (typeof obj.habitatUrl === "string" && obj.habitatUrl.trim()) return obj.habitatUrl.trim();
  return "";
}

export function parseShellClientConfig(raw: unknown): ShellClientConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const habitatUrl = readUrl(obj);
  const remoteAuthToken = typeof obj.remoteAuthToken === "string" ? obj.remoteAuthToken.trim() : "";
  if (!habitatUrl) return null;
  return { habitatUrl, remoteAuthToken };
}

export function normalizeShellClientConfig(input: {
  habitatUrl?: string;
  /** @deprecated 读兼容 */
  hubUrl?: string;
  remoteAuthToken: string;
}): ShellClientConfig {
  const habitatUrl = (input.habitatUrl ?? input.hubUrl ?? "").trim().replace(/\/$/, "");
  const remoteAuthToken = input.remoteAuthToken.trim();
  if (!habitatUrl) throw new Error("栖息地地址不能为空");
  return { habitatUrl, remoteAuthToken };
}

/** 未配置栖息地 API Token 时需先完成连接引导（SAP / Web 壳层） */
export function shellClientNeedsHabitatSetup(config: ShellClientConfig | null): boolean {
  return !config?.remoteAuthToken?.trim();
}
