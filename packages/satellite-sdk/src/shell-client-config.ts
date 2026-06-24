export type ShellClientConfig = {
  hubUrl: string;
  remoteAuthToken: string;
};

export function parseShellClientConfig(raw: unknown): ShellClientConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const hubUrl = typeof obj.hubUrl === "string" ? obj.hubUrl.trim() : "";
  const remoteAuthToken = typeof obj.remoteAuthToken === "string" ? obj.remoteAuthToken.trim() : "";
  if (!hubUrl || !remoteAuthToken) return null;
  return { hubUrl, remoteAuthToken };
}

export function normalizeShellClientConfig(input: {
  hubUrl: string;
  remoteAuthToken: string;
}): ShellClientConfig {
  const hubUrl = input.hubUrl.trim().replace(/\/$/, "");
  const remoteAuthToken = input.remoteAuthToken.trim();
  if (!hubUrl) throw new Error("Hub 地址不能为空");
  if (!remoteAuthToken) throw new Error("远程 Token 不能为空");
  return { hubUrl, remoteAuthToken };
}
