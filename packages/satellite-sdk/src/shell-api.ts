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

/** 通用壳层桥接（Electron preload 注入 window.satelliteShell） */
export type SatelliteShellApi = {
  isElectron: true;
  hubUrl: string;
  hubWsUrl: string;
  /** companion overlay/settings；其他前端为 null */
  windowRole?: CompanionWindowRole | null;
  /** companion sidecar HTTP 根；其他前端为 null */
  apiOrigin?: string | null;
  createFileInstanceStore(appId: string): SapInstanceStore;
  setClickThrough?: (ignore: boolean) => Promise<void>;
  setPointerActive?: (active: boolean) => Promise<void>;
  moveWindow?: (x: number, y: number) => Promise<void>;
  getPatrolScreen?: () => Promise<PatrolScreenInfo>;
  getWindowPosition?: () => Promise<ScreenPoint>;
  listenCursorPosition?: (handler: (pos: ScreenPoint) => void) => () => void;
  startWindowDrag?: () => Promise<void>;
  openSettings?: () => Promise<void>;
  emitConfigChanged?: () => Promise<void>;
  listenConfigChanged?: (handler: () => void) => () => void;
  listenServerError?: (handler: (message: string) => void) => () => void;
};

/** @deprecated 使用 SatelliteShellApi */
export type CompanionShellApi = SatelliteShellApi & {
  windowRole: CompanionWindowRole;
  apiOrigin: string;
};

declare global {
  interface Window {
    satelliteShell?: SatelliteShellApi;
    /** @deprecated 使用 satelliteShell */
    companionShell?: SatelliteShellApi;
  }
}

export type SatelliteShellModule = true;
