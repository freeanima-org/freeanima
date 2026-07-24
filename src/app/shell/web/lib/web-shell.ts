import { browserRemoteInstanceStore } from "@freeanima/shared/rpc-contract";
import { resolveHabitatRpcWsUrl } from "@freeanima/shared/habitat-rpc";
import { buildShellApiFields } from "@freeanima/client/portal-sdk/shell-api-fields";
import { normalizeShellClientConfig } from "@freeanima/client/portal-sdk/shell-client-config";
import type { ShellApi } from "@freeanima/client/portal-sdk/shell-api";
import { readStoredHabitatUrl, REMOTE_AUTH_TOKEN_KEY } from "@freeanima/client/portal-sdk/settings";

export const SHELL_CONFIG_CHANGED_EVENT = "freeanima:shell-config-changed";

function notifyShellConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(SHELL_CONFIG_CHANGED_EVENT));
}

function reloadWebShellFromPrefs(): void {
  const habitatUrl = readStoredHabitatUrl((k) => localStorage.getItem(k));
  const remoteAuthToken = localStorage.getItem(REMOTE_AUTH_TOKEN_KEY)?.trim() ?? "";
  if (!habitatUrl) return;
  installWebShellFromPrefs(habitatUrl, remoteAuthToken);
}

function shellExtras(
  habitatOrigin: string,
): Pick<ShellApi, "createFileInstanceStore" | "emitConfigChanged" | "listenConfigChanged"> {
  return {
    createFileInstanceStore: (appId) => browserRemoteInstanceStore(habitatOrigin, appId),
    async emitConfigChanged(): Promise<void> {
      reloadWebShellFromPrefs();
      notifyShellConfigChanged();
    },
    listenConfigChanged(handler: () => void): () => void {
      const listener = (): void => handler();
      window.addEventListener(SHELL_CONFIG_CHANGED_EVENT, listener);
      return () => window.removeEventListener(SHELL_CONFIG_CHANGED_EVENT, listener);
    },
  };
}

export function normalizeWebHubUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) throw new Error("栖息地地址不能为空");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withScheme);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("栖息地地址须为 http:// 或 https://");
  }
  return `${url.protocol}//${url.host}`;
}

export function createWebShellStub(): ShellApi {
  return {
    habitatUrl: "",
    habitatWsUrl: "",
    windowRole: null,
    apiOrigin: null,
    ...shellExtras(""),
  };
}

export function buildWebShellFromRaw(habitatUrl: string, remoteAuthToken: string): ShellApi {
  const trimmedHabitatUrl = habitatUrl.trim().replace(/\/$/, "");
  if (!trimmedHabitatUrl) return createWebShellStub();
  const habitatWsUrl = resolveHabitatRpcWsUrl(trimmedHabitatUrl);
  const apiFields = buildShellApiFields(trimmedHabitatUrl, habitatWsUrl, remoteAuthToken.trim());
  return {
    ...apiFields,
    windowRole: null,
    apiOrigin: null,
    ...shellExtras(trimmedHabitatUrl),
  };
}

export function buildWebShell(habitatUrl: string, remoteAuthToken: string): ShellApi {
  const normalized = normalizeShellClientConfig({ habitatUrl, remoteAuthToken });
  return buildWebShellFromRaw(normalized.habitatUrl, normalized.remoteAuthToken);
}

export function installWebShellFromPrefs(habitatUrl: string, remoteAuthToken: string): ShellApi {
  const shell = buildWebShellFromRaw(habitatUrl, remoteAuthToken);
  window.portalShell = shell;
  return shell;
}

export async function testWebHabitatConnection(
  habitatUrl: string,
  remoteAuthToken: string,
): Promise<void> {
  const { testHabitatHealthConnection } = await import("@freeanima/client/portal-sdk");
  const normalized = normalizeWebHubUrl(habitatUrl);
  const token = remoteAuthToken.trim();
  await testHabitatHealthConnection(normalized, token || undefined);
}

/** Web 壳层：localStorage / 构建默认值中均未配置 Habitat API Token */
export function webNeedsHubSetupFromConfig(): boolean {
  return !window.portalShell?.remoteAuth?.token?.trim();
}
