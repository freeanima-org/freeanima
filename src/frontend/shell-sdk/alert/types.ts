export type AlertPlatform = "web" | "desktop" | "mobile";

export type AlertPermissionState = "granted" | "denied" | "default" | "unsupported";

export type AlertPayload = {
  title: string;
  body?: string;
  tag?: string;
  sound?: boolean;
  /** 为 true 时仅应用内反馈，不弹 OS 通知 */
  silent?: boolean;
  /** OS 通知保持到用户手动关闭（测试提示等场景） */
  requireInteraction?: boolean;
};

export type AlertContext = {
  sourceRoute?: string;
  suppressOsWhenFocused?: boolean;
};

export type AlertBackend = {
  readonly platform: AlertPlatform;
  /** 读取权限，不弹系统授权框。 */
  readPermission(): Promise<AlertPermissionState>;
  requestPermission(): Promise<AlertPermissionState>;
  show(payload: AlertPayload): Promise<void>;
  playSound?(): void;
};
