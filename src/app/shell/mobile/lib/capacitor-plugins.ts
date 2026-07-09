import {
  isCapacitorNativePlatform,
  isMobileCapacitorShellCandidate,
} from "@freeanima/frontend/shell-sdk/capacitor-runtime.ts";

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
  Capacitor?: {
    Plugins?: {
      Preferences?: Partial<CapacitorPreferencesApi>;
      LocalNotifications?: Partial<CapacitorLocalNotificationsApi>;
    };
  };
};

function capacitorWindow(): CapacitorWindow["Capacitor"] | undefined {
  return (window as CapacitorWindow).Capacitor;
}

function isPreferencesApi(
  value: Partial<CapacitorPreferencesApi> | undefined,
): value is CapacitorPreferencesApi {
  return typeof value?.get === "function" && typeof value?.set === "function";
}

function isLocalNotificationsApi(
  value: Partial<CapacitorLocalNotificationsApi> | undefined,
): value is CapacitorLocalNotificationsApi {
  return (
    typeof value?.schedule === "function" &&
    typeof value?.checkPermissions === "function" &&
    typeof value?.requestPermissions === "function"
  );
}

/** 移动壳 WebView（含远程 Hub 页）应能走原生桥，勿依赖 @capacitor/core 静态 import。 */
export function isMobileCapacitorBridgeExpected(): boolean {
  return isMobileCapacitorShellCandidate() || isCapacitorNativePlatform();
}

export function readWindowPreferencesPlugin(): CapacitorPreferencesApi | null {
  const prefs = capacitorWindow()?.Plugins?.Preferences;
  return isPreferencesApi(prefs) ? prefs : null;
}

export function readWindowLocalNotificationsPlugin(): CapacitorLocalNotificationsApi | null {
  const plugin = capacitorWindow()?.Plugins?.LocalNotifications;
  return isLocalNotificationsApi(plugin) ? plugin : null;
}

export function hasCapacitorPreferencesBridge(): boolean {
  return readWindowPreferencesPlugin() != null;
}

export function hasCapacitorLocalNotificationsBridge(): boolean {
  return readWindowLocalNotificationsPlugin() != null;
}
