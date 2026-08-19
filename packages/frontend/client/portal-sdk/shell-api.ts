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

export type ShellNativeAlertPermission = "granted" | "denied" | "default" | "unsupported";

export type ShellNativeAlertScheduleResult = { id: string };

export type ShellNativeAlertCancelKey = { id?: string; tag?: string };

/** Coding Outpost：工作区 FS（Rust IPC；TS 侧先类型 + stub） */
export type WorkspaceFsDirEntry = {
  name: string;
  kind: "file" | "dir";
  size?: number;
};

export type WorkspaceFsApi = {
  /** 列出绝对路径目录的直接子项 */
  listDir: (absPath: string) => Promise<WorkspaceFsDirEntry[]>;
  readText: (absPath: string) => Promise<string>;
  writeText: (absPath: string, content: string) => Promise<void>;
  exists: (absPath: string) => Promise<boolean>;
  isDir: (absPath: string) => Promise<boolean>;
  /** 递归枚举文件（绝对路径）；跳过 node_modules / .git */
  walkFiles: (absRoot: string, opts?: { maxFiles?: number }) => Promise<string[]>;
  /** 单次 IPC：walk + 内容匹配；未实现时 sandbox 回退 walkFiles + readText */
  searchFiles?: (opts: {
    path: string;
    workspaceRoot: string;
    pattern: string;
    maxFiles?: number;
    limit?: number;
    outputMode?: "content" | "files_only" | "count";
  }) => Promise<string>;
};

export type ShellRunCommandOpts = {
  command: string;
  cwd?: string;
  /** 毫秒；默认由 Rust 侧决定 */
  timeoutMs?: number;
  /** 是否经 shell；默认 false（argv spawn） */
  shell?: boolean;
};

export type ShellRunCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type ShellSaveBlobOpts = {
  filename: string;
  bytes: Uint8Array;
  mimeType?: string;
};

export type ShellSaveBlobResult = {
  cancelled?: boolean;
  path?: string;
};

/** Portal / Web 注入的 `window.portalShell` 桥接 */
export type ShellApi = {
  /** 打包原生壳（Tauri desktop / mobile） */
  isNativeShell?: boolean;
  /** Tauri Portal；`getShellKind` 认 `"tauri"` */
  isTauri?: boolean;
  /** 原生壳构建元数据（desktop/mobile build 时 bake） */
  nativeBuild?: ComponentBuildMeta;
  /** 主输入范式（可选；未设时 Web→媒体查询；Tauri bootstrap 显式注入） */
  primaryInput?: PrimaryInputKind;
  habitatUrl: string;
  habitatWsUrl: string;
  /** 非 loopback Habitat 时的 Bearer / Habitat connect 凭证 */
  remoteAuth?: RemoteAuthCredentials;
  /** 带 Bearer 的 Habitat REST fetch */
  habitatFetch?: HabitatFetch;
  /** companion overlay/settings；其他前端为 null */
  windowRole?: CompanionWindowRole | null;
  /** companion 浏览器/dev HTTP 根；Portal overlay 为 null */
  apiOrigin?: string | null;
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
  /** overlay → 设置：模型加载进度 */
  reportCompanionModelStatus?: (status: {
    loading: boolean;
    error?: string | null;
  }) => Promise<void>;
  /** 设置页：订阅 overlay 模型加载状态 */
  listenCompanionModelStatus?: (
    handler: (status: { loading: boolean; error: string | null }) => void,
  ) => () => void;
  createFileInstanceStore(appId: string): RemoteInstanceStore;
  /**
   * Coding Outpost：工作区文件读写（需 Rust `workspace_fs_*` IPC）。
   * 未实现时 Coding SPA 仅能跑纯路径逻辑 / Bun 单测 backend。
   */
  workspaceFs?: WorkspaceFsApi;
  /**
   * Coding Outpost：在本机执行一次性命令（需 Rust `run_command` IPC）。
   * 工作目录应由调用方限制在 workspace_root 内。
   */
  runCommand?: (opts: ShellRunCommandOpts) => Promise<ShellRunCommandResult>;
  /** 原生文件夹选择器；取消返回 null */
  pickDirectory?: () => Promise<string | null>;
  /**
   * 原生壳保存字节到本机（桌面另存对话框 / Android 系统下载目录）。
   * Web 不注入；调用方应走 `saveOrDownloadBlob`（无此 API 时回退 `<a download>`）。
   */
  saveBlob?: (opts: ShellSaveBlobOpts) => Promise<ShellSaveBlobResult>;
  /** 移动端：打开 连接设置页 */
  openHabitatSettings?: () => void;
  setClickThrough?: (ignore: boolean) => Promise<void>;
  setPointerActive?: (active: boolean) => Promise<void>;
  moveWindow?: (x: number, y: number) => Promise<void>;
  getPatrolScreen?: () => Promise<PatrolScreenInfo>;
  getWindowPosition?: () => Promise<ScreenPoint>;
  /** Overlay：光标相对 companion 窗的 CSS 像素（供 hitTest）；非屏幕绝对坐标 */
  listenCursorPosition?: (handler: (pos: ScreenPoint) => void) => () => void;
  startWindowDrag?: () => Promise<void>;
  openSettings?: () => Promise<void>;
  getCompanionVisible?: () => Promise<boolean>;
  setCompanionVisible?: (visible: boolean) => Promise<void>;
  /** Coding 前哨窗显隐（hide 保 attach） */
  getCodingVisible?: () => Promise<boolean>;
  setCodingVisible?: (visible: boolean) => Promise<void>;
  /** 番茄迷你置顶窗显隐（会话驱动；hide 不 close） */
  getPomodoroFloatVisible?: () => Promise<boolean>;
  setPomodoroFloatVisible?: (visible: boolean) => Promise<void>;
  /** 聚焦主窗并打开番茄钟页 */
  openPomodoro?: () => Promise<void>;
  /** 设置页 → overlay：入队文字气泡（测试 / 调试） */
  enqueueCompanionBubble?: (text: string) => Promise<void>;
  /** overlay：监听入队气泡请求 */
  listenCompanionBubble?: (handler: (text: string) => void) => () => void;
  emitConfigChanged?: () => Promise<void>;
  listenConfigChanged?: (handler: () => void) => () => void;
  listenServerError?: (handler: (message: string) => void) => () => void;
  /** 原生壳 OS 通知（Tauri desktop / mobile） */
  showNativeAlert?: (payload: ShellNativeAlertPayload) => Promise<void>;
  /** 读取本机通知权限，不弹系统授权框 */
  readNativeAlertPermission?: () => Promise<ShellNativeAlertPermission>;
  requestNativeAlertPermission?: () => Promise<ShellNativeAlertPermission>;
  /** 预登记本机提醒；与 cancelNativeAlert 成对 */
  scheduleNativeAlert?: (
    payload: ShellNativeAlertPayload & { at: Date | number },
  ) => Promise<ShellNativeAlertScheduleResult>;
  cancelNativeAlert?: (key: ShellNativeAlertCancelKey) => Promise<void>;
  /**
   * 应用图标未读合计角标（桌面 Dock/任务栏；Web 走 Badging API）。
   * `0` 清除。Android 暂无原生 launcher badge（见 tauri-shell 文档 gap）。
   */
  setAppBadgeCount?: (count: number) => Promise<void>;
  /** 桌面：任务栏/Dock 闪烁请求用户注意（托盘无独立闪烁 API 时同用此路径） */
  requestAppAttention?: () => Promise<void>;
  /** 原生壳：确认后下载 Releases 产物并覆盖安装（Desktop NSIS / Mobile APK） */
  applyPackagedUpdate?: (opts: { assetUrl: string; expectedSize?: number }) => Promise<void>;
  /** 下载/安装进度（Tauri 事件）；桌面侧可能返回 Promise（须 await listen 后再 apply） */
  onPackagedUpdateProgress?: (
    handler: (progress: {
      received: number;
      total: number | null;
      phase?: "downloading" | "installing";
    }) => void,
  ) => (() => void) | Promise<() => void>;
};

declare global {
  interface Window {
    portalShell?: ShellApi;
  }
}

export type PortalShellModule = true;
