import { isRecord } from "@freeanima/shared/util";

export type ShellClientConfig = {
  habitatUrl: string;
  remoteAuthToken: string;
};

export function parseShellClientConfig(raw: unknown): ShellClientConfig | null {
  if (!isRecord(raw)) return null;
  const habitatUrl = typeof raw.habitatUrl === "string" ? raw.habitatUrl.trim() : "";
  const remoteAuthToken = typeof raw.remoteAuthToken === "string" ? raw.remoteAuthToken.trim() : "";
  if (!habitatUrl) return null;
  return { habitatUrl, remoteAuthToken };
}

export function normalizeShellClientConfig(input: {
  habitatUrl?: string;
  remoteAuthToken: string;
}): ShellClientConfig {
  const habitatUrl = (input.habitatUrl ?? "").trim().replace(/\/$/, "");
  const remoteAuthToken = input.remoteAuthToken.trim();
  if (!habitatUrl) throw new Error("栖息地地址不能为空");
  return { habitatUrl, remoteAuthToken };
}

/** 未配置栖息地 API Token 时需先完成连接引导（SAP / Web 壳层） */
export function shellClientNeedsHabitatSetup(config: ShellClientConfig | null): boolean {
  return !config?.remoteAuthToken?.trim();
}
