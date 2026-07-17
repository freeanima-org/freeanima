export type AlertPlatform = "web" | "desktop" | "mobile";

export type AlertPermissionState = "granted" | "denied" | "default" | "unsupported";

/** 预登记闹钟在壳侧能活多久（诚实分级，供设置/诊断）。 */
export type AlertScheduleDurability = "none" | "process" | "os";

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

export type AlertScheduleKey = {
  id?: string;
  tag?: string;
};

export type AlertScheduleResult = {
  id: string;
};

/**
 * 本机 Alert 后端。
 * `schedule` 与 `cancel` 必须成对实现；不支持调度时 `scheduleDurability: "none"`，二者可空操作。
 */
export type AlertBackend = {
  readonly platform: AlertPlatform;
  readonly scheduleDurability: AlertScheduleDurability;
  /** 读取权限，不弹系统授权框。 */
  readPermission(): Promise<AlertPermissionState>;
  requestPermission(): Promise<AlertPermissionState>;
  show(payload: AlertPayload): Promise<void>;
  playSound?(): void;
  /** 预登记；同 tag 再调 = replace。 */
  schedule(payload: AlertPayload, at: Date): Promise<AlertScheduleResult>;
  /** 取消预登记；对不存在的 id/tag 幂等成功。 */
  cancel(key: AlertScheduleKey): Promise<void>;
};
