import type { HabitatFetch, RemoteAuthCredentials } from "./remote-auth.ts";
import type { ComponentBuildMeta } from "./build-meta.ts";
import type { PrimaryInputKind } from "./shell-capability.ts";

/** 与 @freeanima/shared/rpc-contract RemoteInstanceStore 对齐 */
export type RemoteInstanceStore = {
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

/** companion host → overlay runtime 推送（与 RuntimeWsMessage 对齐） */
export type CompanionRuntimeMessage = {
  type: "runtime";
  bubble: {
    current: { id: string; text: string; createdAt: number } | null;
    pending: number;
    version: number;
  };
  play: Array<{ id: string; slot: string; motionId?: string }>;
};

export type ShellNativeAlertPayload = {
  title: string;
  body?: string;
  tag?: string;
  silent?: boolean;
  requireInteraction?: boolean;
};

export type ShellNativeAlertPermission = "granted" | "denied" | "unsupported";

export type ShellNativeAlertScheduleResult = { id: string };

export type ShellNativeAlertCancelKey = { id?: string; tag?: string };

/** 通用壳层桥接（Electron preload / Capacitor 注入 window.satelliteShell） */
export type ShellApi = {
  isElectron: boolean;
  /** Capacitor 等原生壳 */
  isNativeShell?: boolean;
  /** 未来 Tauri 壳标记（Phase 2+）；getShellKind 认 "tauri" */
  isTauri?: boolean;
  /** 原生壳构建元数据（desktop/mobile build 时 bake） */
  nativeBuild?: ComponentBuildMeta;
  /** 主输入范式（可选；未设时 Electron→pointer，Capacitor→touch，Web→媒体查询） */
  primaryInput?: PrimaryInputKind;
  habitatUrl: string;
  habitatWsUrl: string;
  /** 非 loopback Habitat 时的 Bearer / SAP connect 凭证 */
  remoteAuth?: RemoteAuthCredentials;
  /** 带 Bearer 的 Habitat REST fetch */
  habitatFetch?: HabitatFetch;
  /** companion overlay/settings；其他前端为 null */
  windowRole?: CompanionWindowRole | null;
  /** companion sidecar HTTP 根；其他前端为 null */
  apiOrigin?: string | null;
  /** Electron：订阅 companion runtime（bubble / play_slot）；返回取消函数
   * @deprecated overlay 本地执行 tools 后不再需要；保留兼容 */
  listenCompanionRuntime?: (handler: (message: CompanionRuntimeMessage) => void) => () => void;
  /** Electron：点击气泡下一条（等价 POST /api/bubbles/advance）
   * @deprecated 使用 overlay 本地 advanceBubbleLocal */
  advanceCompanionBubble?: () => Promise<{
    current: { id: string; text: string; createdAt: number } | null;
  }>;
  /** Electron：拉取当前 runtime 快照（订阅前补一次）
   * @deprecated overlay 本地 runtime */
  getCompanionRuntimeSnapshot?: () => Promise<CompanionRuntimeMessage>;
  /** overlay → main：上报 remote tools 连接状态（供设置页读取） */
  reportCompanionRemoteToolsStatus?: (status: {
    instance_id: string;
    remote_tools_connected: boolean;
  }) => Promise<void>;
  /** 设置页：读取 overlay 上报的 remote tools 状态 */
  getCompanionRemoteToolsStatus?: () => Promise<{
    instance_id: string;
    remote_tools_connected: boolean;
  }>;
  createFileInstanceStore(appId: string): RemoteInstanceStore;
  /** 移动端：打开 连接设置页 */
  openHabitatSettings?: () => void;
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
  /** 预登记本机提醒；与 cancelNativeAlert 成对 */
  scheduleNativeAlert?: (
    payload: ShellNativeAlertPayload & { at: Date | number },
  ) => Promise<ShellNativeAlertScheduleResult>;
  cancelNativeAlert?: (key: ShellNativeAlertCancelKey) => Promise<void>;
  /** 原生壳：确认后下载 Releases 产物并覆盖安装（Desktop NSIS / Mobile APK） */
  applyPackagedUpdate?: (opts: { assetUrl: string; expectedSize?: number }) => Promise<void>;
  /** 下载/安装进度（Desktop IPC / Mobile Capacitor 事件） */
  onPackagedUpdateProgress?: (
    handler: (progress: {
      received: number;
      total: number | null;
      phase?: "downloading" | "installing";
    }) => void,
  ) => () => void;
};

declare global {
  interface Window {
    satelliteShell?: ShellApi;
  }
}

export type SatelliteShellModule = true;
