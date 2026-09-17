import { toast } from "sonner";

export const SHELL_TOAST_IDS = {
  connectivity: "shell-connectivity",
  shellUpdate: "shell-update",
  serviceUpdate: "shell-service-update",
  offlineSync: "shell-offline-sync",
  pwaUpdate: "shell-pwa-update",
  pwaOfflineReady: "shell-pwa-offline-ready",
  pwaInstall: "shell-pwa-install",
} as const;

export type ShellToastId = (typeof SHELL_TOAST_IDS)[keyof typeof SHELL_TOAST_IDS];

export type ShellToastAction = {
  label: string;
  /** Sonner 会传入 click event；须 preventDefault 才能阻止 action 后自动 dismiss */
  onClick: (event?: { preventDefault?: () => void }) => void;
};

export type ShellToastCancel = {
  label: string;
  onClick?: () => void;
};

export type ShellToastOptions = {
  description?: string;
  duration?: number;
  /** 缺省 undefined 时显式清空，避免 Sonner 合并保留旧 action */
  action?: ShellToastAction;
  cancel?: ShellToastCancel;
  /** 默认 true；下载进度等场景可设 false 防止误关 */
  dismissible?: boolean;
};

/** 供单测：始终带上 action/cancel 键，便于同 id 更新时清掉按钮 */
export function buildShellToastSonnerOptions(options?: ShellToastOptions): {
  description?: string;
  duration: number;
  dismissible: boolean;
  action: ShellToastAction | undefined;
  cancel: { label: string; onClick: () => void } | undefined;
} {
  return {
    ...(options?.description != null ? { description: options.description } : {}),
    duration: options?.duration ?? Number.POSITIVE_INFINITY,
    dismissible: options?.dismissible ?? true,
    action: options?.action,
    cancel:
      options?.cancel != null
        ? {
            label: options.cancel.label,
            onClick: options.cancel.onClick ?? (() => undefined),
          }
        : undefined,
  };
}

export function dismissShellToast(id: ShellToastId): void {
  toast.dismiss(id);
}

export function showShellToast(
  id: ShellToastId,
  message: string,
  options?: ShellToastOptions,
): void {
  toast(message, {
    id,
    ...buildShellToastSonnerOptions(options),
  });
}

export { toast };
