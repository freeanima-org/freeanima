import { Preferences } from "@capacitor/preferences";
import { resolveHubWsUrl } from "@freeanima/sap-contract/urls";
import type { SapInstanceStore } from "@freeanima/satellite-sdk";
import type { SatelliteShellApi } from "@freeanima/satellite-sdk";

import { HUB_URL_KEY, sapInstanceKey } from "./prefs-keys.ts";
import { SETTINGS_PAGE } from "./paths.ts";

const SHELL_SNAPSHOT_KEY = "freeanima.shell.snapshot";

export type ShellSnapshot = {
  hubUrl: string;
  hubWsUrl: string;
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

export async function saveHubUrl(hubUrl: string): Promise<void> {
  const normalized = normalizeHubUrl(hubUrl);
  await Preferences.set({ key: HUB_URL_KEY, value: normalized });
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
    if (parsed.hubUrl?.trim() && parsed.hubWsUrl?.trim()) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export async function buildMobileShell(hubUrl: string): Promise<SatelliteShellApi> {
  const normalized = normalizeHubUrl(hubUrl);
  const hubWsUrl = resolveHubWsUrl(normalized);
  const snapshot: ShellSnapshot = { hubUrl: normalized, hubWsUrl };
  writeShellSnapshot(snapshot);
  return createShellFromSnapshot(snapshot);
}

function createShellFromSnapshot(snapshot: ShellSnapshot): SatelliteShellApi {
  return {
    isElectron: false,
    isNativeShell: true,
    hubUrl: snapshot.hubUrl,
    hubWsUrl: snapshot.hubWsUrl,
    windowRole: null,
    apiOrigin: null,
    createFileInstanceStore: createPreferencesInstanceStore,
    openHubSettings(): void {
      window.location.href = SETTINGS_PAGE;
    },
  };
}

/** 从 Preferences 加载并注入 window.satelliteShell */
export async function installMobileShellFromPrefs(): Promise<SatelliteShellApi | null> {
  const hubUrl = await loadHubUrl();
  if (!hubUrl) return null;
  const shell = await buildMobileShell(hubUrl);
  window.satelliteShell = shell;
  return shell;
}

/** chat 页：sessionStorage 快照 + Preferences instance store */
export async function ensureMobileShellForChat(): Promise<SatelliteShellApi> {
  let snapshot = readShellSnapshot();
  if (!snapshot) {
    const hubUrl = await loadHubUrl();
    if (!hubUrl) {
      window.location.replace(SETTINGS_PAGE);
      throw new Error("redirect settings");
    }
    snapshot = {
      hubUrl: normalizeHubUrl(hubUrl),
      hubWsUrl: resolveHubWsUrl(normalizeHubUrl(hubUrl)),
    };
    writeShellSnapshot(snapshot);
  }
  const shell = createShellFromSnapshot(snapshot);
  window.satelliteShell = shell;
  return shell;
}

/** 测试 Hub WebSocket 是否可达 */
export function testHubConnection(hubWsUrl: string, timeoutMs = 5000): Promise<void> {
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
