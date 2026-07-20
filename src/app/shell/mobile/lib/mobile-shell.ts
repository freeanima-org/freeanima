import { resolveHabitatRpcWsUrl } from "@freeanima/shared/habitat-rpc";
import {
  buildShellApiFields,
  normalizeShellClientConfig,
  testHabitatHealthConnection,
  type SapInstanceStore,
  type SatelliteShellApi,
} from "@freeanima/frontend/shell-sdk";
import type { ComponentBuildMeta } from "@freeanima/frontend/shell-sdk/build-meta";

import { loadMobileNativeBuildMeta } from "./native-build-meta-prefs.ts";
import { HABITAT_URL_KEY, REMOTE_AUTH_TOKEN_KEY, sapInstanceKey } from "./prefs-keys.ts";
import { prefsGet, prefsSet } from "./prefs-safe.ts";
import { SETTINGS_PAGE } from "./paths.ts";
import { replaceShellPath } from "./shell-nav.ts";

const SHELL_SNAPSHOT_KEY = "freeanima.shell.snapshot";

export function attachNativeBuild(
  shell: SatelliteShellApi,
  nativeBuild?: ComponentBuildMeta,
): SatelliteShellApi {
  return nativeBuild ? { ...shell, nativeBuild } : shell;
}

export type ShellSnapshot = {
  habitatUrl: string;
  habitatWsUrl: string;
  remoteAuthToken: string;
};

export function normalizeHabitatUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) throw new Error("栖息地地址不能为空");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withScheme);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("栖息地地址须为 http:// 或 https://");
  }
  return `${url.protocol}//${url.host}`;
}

export async function loadHabitatUrl(): Promise<string | null> {
  const { value } = await prefsGet({ key: HABITAT_URL_KEY });
  return value?.trim() || null;
}

export async function loadRemoteAuthToken(): Promise<string | null> {
  const { value } = await prefsGet({ key: REMOTE_AUTH_TOKEN_KEY });
  return value?.trim() || null;
}

export async function saveShellClientPrefs(
  habitatUrl: string,
  remoteAuthToken: string,
): Promise<void> {
  const normalized = normalizeShellClientConfig({ habitatUrl, remoteAuthToken });
  await prefsSet({ key: HABITAT_URL_KEY, value: normalized.habitatUrl });
  await prefsSet({ key: REMOTE_AUTH_TOKEN_KEY, value: normalized.remoteAuthToken });
}

export function createPreferencesInstanceStore(appId: string): SapInstanceStore {
  const key = sapInstanceKey(appId);
  return {
    async load(): Promise<string | null> {
      const { value } = await prefsGet({ key });
      return value?.trim() || null;
    },
    async save(instanceId: string): Promise<void> {
      await prefsSet({ key, value: instanceId.trim() });
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
    if (parsed.habitatUrl?.trim() && parsed.habitatWsUrl?.trim()) {
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

type PackagedUpdateProgressHandler = (progress: {
  received: number;
  total: number | null;
  phase?: "downloading" | "installing";
}) => void;

let packagedUpdateProgressHandler: PackagedUpdateProgressHandler | null = null;

function subscribePackagedUpdateProgress(handler: PackagedUpdateProgressHandler): () => void {
  packagedUpdateProgressHandler = handler;
  return () => {
    if (packagedUpdateProgressHandler === handler) {
      packagedUpdateProgressHandler = null;
    }
  };
}

async function applyMobilePackagedUpdate(assetUrl: string): Promise<void> {
  const { installApkFromUrl } = await import("./apk-installer.ts");
  await installApkFromUrl(assetUrl, {
    onProgress: (progress) => {
      packagedUpdateProgressHandler?.(progress);
    },
  });
}

function createShellFromSnapshot(snapshot: ShellSnapshot): SatelliteShellApi {
  const apiFields = buildShellApiFields(
    snapshot.habitatUrl,
    snapshot.habitatWsUrl,
    snapshot.remoteAuthToken,
  );
  return {
    isElectron: false,
    isNativeShell: true,
    primaryInput: "touch",
    ...apiFields,
    windowRole: null,
    apiOrigin: null,
    createFileInstanceStore: createPreferencesInstanceStore,
    openHabitatSettings(): void {
      replaceShellPath(SETTINGS_PAGE);
    },
    async applyPackagedUpdate({ assetUrl }): Promise<void> {
      await applyMobilePackagedUpdate(assetUrl);
    },
    onPackagedUpdateProgress: subscribePackagedUpdateProgress,
    async emitConfigChanged(): Promise<void> {
      notifyShellConfigChanged();
    },
    listenConfigChanged(handler: () => void): () => void {
      const listener = (): void => handler();
      window.addEventListener(SHELL_CONFIG_CHANGED_EVENT, listener);
      return () => window.removeEventListener(SHELL_CONFIG_CHANGED_EVENT, listener);
    },
  };
}

/** Habitat 未配置时的 minimal 壳层标记（供设置页正确识别 mobile 平台） */
export function createMobileShellStub(): SatelliteShellApi {
  return {
    isElectron: false,
    isNativeShell: true,
    primaryInput: "touch",
    habitatUrl: "",
    habitatWsUrl: "",
    windowRole: null,
    apiOrigin: null,
    createFileInstanceStore: createPreferencesInstanceStore,
    openHabitatSettings(): void {
      replaceShellPath(SETTINGS_PAGE);
    },
    async applyPackagedUpdate({ assetUrl }): Promise<void> {
      await applyMobilePackagedUpdate(assetUrl);
    },
    onPackagedUpdateProgress: subscribePackagedUpdateProgress,
    async emitConfigChanged(): Promise<void> {
      notifyShellConfigChanged();
    },
    listenConfigChanged(handler: () => void): () => void {
      const listener = (): void => handler();
      window.addEventListener(SHELL_CONFIG_CHANGED_EVENT, listener);
      return () => window.removeEventListener(SHELL_CONFIG_CHANGED_EVENT, listener);
    },
  };
}

export async function buildMobileShell(
  habitatUrl: string,
  remoteAuthToken: string,
): Promise<SatelliteShellApi> {
  const normalized = normalizeShellClientConfig({ habitatUrl, remoteAuthToken });
  const habitatWsUrl = resolveHabitatRpcWsUrl(normalized.habitatUrl);
  const snapshot: ShellSnapshot = {
    habitatUrl: normalized.habitatUrl,
    habitatWsUrl,
    remoteAuthToken: normalized.remoteAuthToken,
  };
  writeShellSnapshot(snapshot);
  const nativeBuild = await loadMobileNativeBuildMeta();
  return attachNativeBuild(createShellFromSnapshot(snapshot), nativeBuild);
}

/** 从 Preferences 加载并注入 window.satelliteShell */
export async function installMobileShellFromPrefs(): Promise<SatelliteShellApi | null> {
  const habitatUrl = await loadHabitatUrl();
  if (!habitatUrl) return null;
  const remoteAuthToken = (await loadRemoteAuthToken()) ?? "";
  const shell = await buildMobileShell(habitatUrl, remoteAuthToken);
  window.satelliteShell = shell;
  return shell;
}

/** chat 页：sessionStorage 快照 + Preferences instance store */
export async function ensureMobileShellForChat(): Promise<SatelliteShellApi> {
  let snapshot = readShellSnapshot();
  if (!snapshot) {
    const habitatUrl = await loadHabitatUrl();
    if (!habitatUrl) {
      replaceShellPath(SETTINGS_PAGE);
      throw new Error("redirect settings");
    }
    const remoteAuthToken = (await loadRemoteAuthToken()) ?? "";
    const normalized = normalizeShellClientConfig({ habitatUrl, remoteAuthToken });
    snapshot = {
      habitatUrl: normalized.habitatUrl,
      habitatWsUrl: resolveHabitatRpcWsUrl(normalized.habitatUrl),
      remoteAuthToken: normalized.remoteAuthToken,
    };
    writeShellSnapshot(snapshot);
  }
  const nativeBuild = await loadMobileNativeBuildMeta();
  const shell = attachNativeBuild(createShellFromSnapshot(snapshot), nativeBuild);
  window.satelliteShell = shell;
  return shell;
}

/** 测试 Habitat REST 是否可达且认证通过 */
export async function testHabitatConnection(
  habitatUrl: string,
  remoteAuthToken: string,
): Promise<void> {
  const normalized = normalizeHabitatUrl(habitatUrl);
  const token = remoteAuthToken.trim();
  await testHabitatHealthConnection(normalized, token || undefined);
}
