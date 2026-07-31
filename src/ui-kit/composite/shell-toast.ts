import { toast } from "sonner";

export const SHELL_TOAST_IDS = {
  connectivity: "shell-connectivity",
  shellUpdate: "shell-update",
  offlineSync: "shell-offline-sync",
  pwaUpdate: "shell-pwa-update",
  pwaOfflineReady: "shell-pwa-offline-ready",
  pwaInstall: "shell-pwa-install",
} as const;

export type ShellToastId = (typeof SHELL_TOAST_IDS)[keyof typeof SHELL_TOAST_IDS];

export function dismissShellToast(id: ShellToastId): void {
  toast.dismiss(id);
}

export function showShellToast(
  id: ShellToastId,
  message: string,
  options?: {
    description?: string;
    duration?: number;
    action?: { label: string; onClick: () => void };
    cancel?: { label: string; onClick?: () => void };
  },
): void {
  toast(message, {
    id,
    ...(options?.description != null ? { description: options.description } : {}),
    duration: options?.duration ?? Number.POSITIVE_INFINITY,
    ...(options?.action != null ? { action: options.action } : {}),
    ...(options?.cancel != null
      ? {
          cancel: {
            label: options.cancel.label,
            onClick: options.cancel.onClick ?? (() => undefined),
          },
        }
      : {}),
  });
}

export { toast };
