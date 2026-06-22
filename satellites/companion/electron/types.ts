export type ScreenPoint = { x: number; y: number };

export type PatrolScreenInfo = {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  windowWidth: number;
  windowHeight: number;
};

export type CompanionShellApi = {
  isElectron: true;
  apiOrigin: string;
  setClickThrough: (ignore: boolean) => Promise<void>;
  setPointerActive: (active: boolean) => Promise<void>;
  moveWindow: (x: number, y: number) => Promise<void>;
  getPatrolScreen: () => Promise<PatrolScreenInfo>;
  getWindowPosition: () => Promise<ScreenPoint>;
  listenCursorPosition: (handler: (pos: ScreenPoint) => void) => () => void;
  startWindowDrag: () => Promise<void>;
  openSettings: () => Promise<void>;
  emitConfigChanged: () => Promise<void>;
  listenConfigChanged: (handler: () => void) => () => void;
  listenServerError: (handler: (message: string) => void) => () => void;
};

declare global {
  interface Window {
    companionShell?: CompanionShellApi;
  }
}

/** 保持 module 作用域，供 `declare global` 使用 */
export type CompanionElectronModule = true;
