import { Preferences } from "@capacitor/preferences";
import { resolveHubWsUrl } from "@freeanima/sap-contract/urls";
import {
  buildShellApiFields,
  hubRequiresRemoteAuth,
  normalizeShellClientConfig,
  type SapInstanceStore,
  type SatelliteShellApi,
} from "@freeanima/satellite-sdk";

import { HUB_URL_KEY, REMOTE_AUTH_TOKEN_KEY, sapInstanceKey } from "./prefs-keys.ts";
import { SETTINGS_PAGE } from "./paths.ts";
import { replaceShellPath } from "./shell-nav.ts";

const SHELL_SNAPSHOT_KEY = "freeanima.shell.snapshot";

export type ShellSnapshot = {
  hubUrl: string;
  hubWsUrl: string;
  remoteAuthToken: string;
};

export function normalizeHubUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) throw new Error("Hub 地址不能为空");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withScheme);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Hub 地址须为 http:// 或 https://");
  }
  return `${url.protocol}//${url.host}`;
}

export async function loadHubUrl(): Promise<string | null> {
  const { value } = await Preferences.get({ key: HUB_URL_KEY });
  return value?.trim() || null;
}

export async function loadRemoteAuthToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: REMOTE_AUTH_TOKEN_KEY });
  return value?.trim() || null;
}

export async function saveShellClientPrefs(hubUrl: string, remoteAuthToken: string): Promise<void> {
  const normalized = normalizeShellClientConfig({ hubUrl, remoteAuthToken });
  await Preferences.set({ key: HUB_URL_KEY, value: normalized.hubUrl });
  await Preferences.set({ key: REMOTE_AUTH_TOKEN_KEY, value: normalized.remoteAuthToken });
}

export function createPreferencesInstanceStore(appId: string): SapInstanceStore {
  const key = sapInstanceKey(appId);
  return {
    async load(): Promise<string | null> {
      const { value } = await Preferences.get({ key });
      return value?.trim() || null;
    },
    async save(instanceId: string): Promise<void> {
      await Preferences.set({ key, value: instanceId.trim() });
    },
  };
}

export function writeShellSnapshot(snapshot: ShellSnapshot): void {
  sessionStorage.setItem(SHELL_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function readShellSnapshot(): ShellSnapshot | null {
  const raw = sessionStorage.getItem(SHELL_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ShellSnapshot;
    if (parsed.hubUrl?.trim() && parsed.hubWsUrl?.trim() && parsed.remoteAuthToken?.trim()) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export const SHELL_CONFIG_CHANGED_EVENT = "freeanima:shell-config-changed";

function notifyShellConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(SHELL_CONFIG_CHANGED_EVENT));
}

function createShellFromSnapshot(snapshot: ShellSnapshot): SatelliteShellApi {
  const apiFields = buildShellApiFields(
    snapshot.hubUrl,
    snapshot.hubWsUrl,
    snapshot.remoteAuthToken,
  );
  return {
    isElectron: false,
    isNativeShell: true,
    ...apiFields,
    windowRole: null,
    apiOrigin: null,
    createFileInstanceStore: createPreferencesInstanceStore,
    openHubSettings(): void {
      replaceShellPath(SETTINGS_PAGE);
    },
    async emitConfigChanged(): Promise<void> {
      notifyShellConfigChanged();
    },
  };
}

/** Hub 未配置时的 minimal 壳层标记（供设置页正确识别 mobile 平台） */
export function createMobileShellStub(): SatelliteShellApi {
  return {
    isElectron: false,
    isNativeShell: true,
    hubUrl: "",
    hubWsUrl: "",
    windowRole: null,
    apiOrigin: null,
    createFileInstanceStore: createPreferencesInstanceStore,
    openHubSettings(): void {
      replaceShellPath(SETTINGS_PAGE);
    },
    async emitConfigChanged(): Promise<void> {
      notifyShellConfigChanged();
    },
  };
}

export async function buildMobileShell(
  hubUrl: string,
  remoteAuthToken: string,
): Promise<SatelliteShellApi> {
  const normalized = normalizeShellClientConfig({ hubUrl, remoteAuthToken });
  const hubWsUrl = resolveHubWsUrl(normalized.hubUrl);
  const snapshot: ShellSnapshot = {
    hubUrl: normalized.hubUrl,
    hubWsUrl,
    remoteAuthToken: normalized.remoteAuthToken,
  };
  writeShellSnapshot(snapshot);
  return createShellFromSnapshot(snapshot);
}

/** 从 Preferences 加载并注入 window.satelliteShell */
export async function installMobileShellFromPrefs(): Promise<SatelliteShellApi | null> {
  const hubUrl = await loadHubUrl();
  const remoteAuthToken = await loadRemoteAuthToken();
  if (!hubUrl || !remoteAuthToken) return null;
  const shell = await buildMobileShell(hubUrl, remoteAuthToken);
  window.satelliteShell = shell;
  return shell;
}

/** chat 页：sessionStorage 快照 + Preferences instance store */
export async function ensureMobileShellForChat(): Promise<SatelliteShellApi> {
  let snapshot = readShellSnapshot();
  if (!snapshot) {
    const hubUrl = await loadHubUrl();
    const remoteAuthToken = await loadRemoteAuthToken();
    if (!hubUrl || !remoteAuthToken) {
      replaceShellPath(SETTINGS_PAGE);
      throw new Error("redirect settings");
    }
    const normalized = normalizeShellClientConfig({ hubUrl, remoteAuthToken });
    snapshot = {
      hubUrl: normalized.hubUrl,
      hubWsUrl: resolveHubWsUrl(normalized.hubUrl),
      remoteAuthToken: normalized.remoteAuthToken,
    };
    writeShellSnapshot(snapshot);
  }
  const shell = createShellFromSnapshot(snapshot);
  window.satelliteShell = shell;
  return shell;
}

/** 测试 Hub REST 是否可达 */
export async function testHubConnection(hubUrl: string, remoteAuthToken: string): Promise<void> {
  const normalized = normalizeHubUrl(hubUrl);
  const token = remoteAuthToken.trim();
  if (hubRequiresRemoteAuth(normalized, token)) {
    const res = await fetch(`${normalized}/api/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return;
  }
  const wsUrl = resolveHubWsUrl(normalized);
  await testHubWebSocket(wsUrl);
}

function testHubWebSocket(hubWsUrl: string, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(hubWsUrl);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.close();
      reject(new Error("连接超时"));
    }, timeoutMs);
    ws.onopen = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      resolve();
    };
    ws.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("无法连接 Hub WebSocket"));
    };
  });
}
