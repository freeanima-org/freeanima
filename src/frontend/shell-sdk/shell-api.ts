import type { HubFetch, RemoteAuthCredentials } from "./remote-auth.ts";
import type { ComponentBuildMeta } from "./build-meta.ts";
import type { PrimaryInputKind } from "./shell-capability.ts";

/** 与 @freeanima/sap-contract SapInstanceStore 对齐 */
export type SapInstanceStore = {
  load(): Promise<string | null> | string | null;
  save(instanceId: string): Promise<void> | void;
};

export type ScreenPoint = { x: number; y: number };

export type PatrolScreenInfo = {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  windowWidth: number;
  windowHeight: number;
};

export type CompanionWindowRole = "overlay" | "settings";

export type ShellNativeAlertPayload = {
  title: string;
  body?: string;
  tag?: string;
  silent?: boolean;
  requireInteraction?: boolean;
};

export type ShellNativeAlertPermission = "granted" | "denied" | "unsupported";

/** 通用壳层桥接（Electron preload / Capacitor 注入 window.satelliteShell） */
export type SatelliteShellApi = {
  isElectron: boolean;
  /** Capacitor 等原生壳 */
  isNativeShell?: boolean;
  /** 原生壳构建元数据（desktop/mobile build 时 bake） */
  nativeBuild?: ComponentBuildMeta;
  /** 主输入范式（可选；未设时 Electron→pointer，Capacitor→touch，Web→媒体查询） */
  primaryInput?: PrimaryInputKind;
  hubUrl: string;
  hubWsUrl: string;
  /** 非 loopback Hub 时的 Bearer / SAP connect 凭证 */
  remoteAuth?: RemoteAuthCredentials;
  /** 带 Bearer 的 Hub REST fetch */
  hubFetch?: HubFetch;
  /** companion overlay/settings；其他前端为 null */
  windowRole?: CompanionWindowRole | null;
  /** companion sidecar HTTP 根；其他前端为 null */
  apiOrigin?: string | null;
  createFileInstanceStore(appId: string): SapInstanceStore;
  /** 移动端：打开 Hub 设置页 */
  openHubSettings?: () => void;
  setClickThrough?: (ignore: boolean) => Promise<void>;
  setPointerActive?: (active: boolean) => Promise<void>;
  moveWindow?: (x: number, y: number) => Promise<void>;
  getPatrolScreen?: () => Promise<PatrolScreenInfo>;
  getWindowPosition?: () => Promise<ScreenPoint>;
  listenCursorPosition?: (handler: (pos: ScreenPoint) => void) => () => void;
  startWindowDrag?: () => Promise<void>;
  openSettings?: () => Promise<void>;
  getCompanionVisible?: () => Promise<boolean>;
  setCompanionVisible?: (visible: boolean) => Promise<void>;
  emitConfigChanged?: () => Promise<void>;
  listenConfigChanged?: (handler: () => void) => () => void;
  listenServerError?: (handler: (message: string) => void) => () => void;
  /** 原生壳 OS 通知（Electron 主进程 / Capacitor Local Notifications） */
  showNativeAlert?: (payload: ShellNativeAlertPayload) => Promise<void>;
  requestNativeAlertPermission?: () => Promise<ShellNativeAlertPermission>;
  /** 原生壳：确认后下载 Releases 产物并覆盖安装（Desktop NSIS / Mobile APK） */
  applyPackagedUpdate?: (opts: { assetUrl: string; expectedSize?: number }) => Promise<void>;
};

declare global {
  interface Window {
    satelliteShell?: SatelliteShellApi;
  }
}

export type SatelliteShellModule = true;
