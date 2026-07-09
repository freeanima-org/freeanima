import {
  isCapacitorNativePlatform,
  isMobileCapacitorShellCandidate,
} from "@freeanima/frontend/shell-sdk/capacitor-runtime.ts";

export type CapacitorNativeBridge = {
  nativePromise: (plugin: string, method: string, options?: object) => Promise<unknown>;
  getPlatform?: () => string;
};

export type CapacitorPreferencesApi = {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
};

export type CapacitorLocalNotificationsApi = {
  checkPermissions(): Promise<{ display: string }>;
  requestPermissions(): Promise<{ display: string }>;
  schedule(options: { notifications: unknown[] }): Promise<void>;
  createChannel?(options: {
    id: string;
    name: string;
    description?: string;
    importance?: number;
    visibility?: number;
    vibration?: boolean;
  }): Promise<void>;
};

type CapacitorWindow = Window & {
  Capacitor?: CapacitorNativeBridge;
  __freeanimaCapacitorNative?: CapacitorNativeBridge;
};

function readLiveCapacitor(): CapacitorNativeBridge | undefined {
  return (window as CapacitorWindow).Capacitor;
}

/** shell-bridge 启动时缓存原生桥，避免 Hub bundle 加载 @capacitor/core 后覆盖 window.Capacitor。 */
export function pinCapacitorNativeBridge(): CapacitorNativeBridge | null {
  const cap = readLiveCapacitor();
  if (!cap?.nativePromise) return null;
  (window as CapacitorWindow).__freeanimaCapacitorNative = cap;
  return cap;
}

export function readPinnedCapacitorNativeBridge(): CapacitorNativeBridge | null {
  const pinned = (window as CapacitorWindow).__freeanimaCapacitorNative;
  if (pinned?.nativePromise) return pinned;
  const live = readLiveCapacitor();
  return live?.nativePromise ? live : null;
}

/** 移动壳 WebView（含远程 Hub 页）应能走原生桥，勿依赖 @capacitor/* 静态 import。 */
export function isMobileCapacitorBridgeExpected(): boolean {
  return isMobileCapacitorShellCandidate() || isCapacitorNativePlatform();
}

export function hasCapacitorNativeBridge(): boolean {
  return readPinnedCapacitorNativeBridge() != null;
}

function invokeNative<T>(plugin: string, method: string, options?: object): Promise<T> {
  const cap = readPinnedCapacitorNativeBridge();
  if (!cap?.nativePromise) {
    return Promise.reject(new Error(`Capacitor 原生桥不可用（${plugin}.${method}）`));
  }
  return cap.nativePromise(plugin, method, options) as Promise<T>;
}

export function createPreferencesApiFromNativeBridge(): CapacitorPreferencesApi | null {
  if (!hasCapacitorNativeBridge()) return null;
  return {
    get: (options) => invokeNative("Preferences", "get", options),
    set: (options) => invokeNative("Preferences", "set", options).then(() => undefined),
  };
}

export function createLocalNotificationsApiFromNativeBridge(): CapacitorLocalNotificationsApi | null {
  if (!hasCapacitorNativeBridge()) return null;
  return {
    checkPermissions: () => invokeNative("LocalNotifications", "checkPermissions"),
    requestPermissions: () => invokeNative("LocalNotifications", "requestPermissions"),
    schedule: (options) =>
      invokeNative("LocalNotifications", "schedule", options).then(() => undefined),
    createChannel: (options) =>
      invokeNative("LocalNotifications", "createChannel", options).then(() => undefined),
  };
}

export function readCapacitorPlatform(): string | null {
  return readPinnedCapacitorNativeBridge()?.getPlatform?.() ?? null;
}
