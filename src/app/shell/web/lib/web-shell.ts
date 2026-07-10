import { browserSapInstanceStore } from "@freeanima/shared/sap-contract";
import { resolveHubRpcWsUrl } from "@freeanima/shared/hub-rpc";
import { buildShellApiFields } from "@freeanima/frontend/shell-sdk/shell-api-fields";
import { normalizeShellClientConfig } from "@freeanima/frontend/shell-sdk/shell-client-config";
import type { SatelliteShellApi } from "@freeanima/frontend/shell-sdk/shell-api";
import { HUB_URL_KEY, REMOTE_AUTH_TOKEN_KEY } from "@freeanima/frontend/shell-sdk/settings";

export const SHELL_CONFIG_CHANGED_EVENT = "freeanima:shell-config-changed";

function notifyShellConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(SHELL_CONFIG_CHANGED_EVENT));
}

function reloadWebShellFromPrefs(): void {
  const hubUrl = localStorage.getItem(HUB_URL_KEY)?.trim() ?? "";
  const remoteAuthToken = localStorage.getItem(REMOTE_AUTH_TOKEN_KEY)?.trim() ?? "";
  if (!hubUrl) return;
  installWebShellFromPrefs(hubUrl, remoteAuthToken);
}

function shellExtras(
  hubOrigin: string,
): Pick<
  SatelliteShellApi,
  "createFileInstanceStore" | "emitConfigChanged" | "listenConfigChanged"
> {
  return {
    createFileInstanceStore: (appId) => browserSapInstanceStore(hubOrigin, appId),
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
  if (!trimmed) throw new Error("Hub 地址不能为空");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withScheme);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Hub 地址须为 http:// 或 https://");
  }
  return `${url.protocol}//${url.host}`;
}

export function createWebShellStub(): SatelliteShellApi {
  return {
    isElectron: false,
    hubUrl: "",
    hubWsUrl: "",
    windowRole: null,
    apiOrigin: null,
    ...shellExtras(""),
  };
}

export function buildWebShellFromRaw(hubUrl: string, remoteAuthToken: string): SatelliteShellApi {
  const trimmedHub = hubUrl.trim().replace(/\/$/, "");
  if (!trimmedHub) return createWebShellStub();
  const hubWsUrl = resolveHubRpcWsUrl(trimmedHub);
  const apiFields = buildShellApiFields(trimmedHub, hubWsUrl, remoteAuthToken.trim());
  return {
    isElectron: false,
    ...apiFields,
    windowRole: null,
    apiOrigin: null,
    ...shellExtras(trimmedHub),
  };
}

export function buildWebShell(hubUrl: string, remoteAuthToken: string): SatelliteShellApi {
  const normalized = normalizeShellClientConfig({ hubUrl, remoteAuthToken });
  return buildWebShellFromRaw(normalized.hubUrl, normalized.remoteAuthToken);
}

export function installWebShellFromPrefs(
  hubUrl: string,
  remoteAuthToken: string,
): SatelliteShellApi {
  const shell = buildWebShellFromRaw(hubUrl, remoteAuthToken);
  window.satelliteShell = shell;
  return shell;
}

export async function testWebHubConnection(hubUrl: string, remoteAuthToken: string): Promise<void> {
  const { testHubHealthConnection } = await import("@freeanima/frontend/shell-sdk");
  const normalized = normalizeWebHubUrl(hubUrl);
  const token = remoteAuthToken.trim();
  await testHubHealthConnection(normalized, token || undefined);
}

/** Web 壳层：localStorage / 构建默认值中均未配置 Hub API Token */
export function webNeedsHubSetupFromConfig(): boolean {
  return !window.satelliteShell?.remoteAuth?.token?.trim();
}
