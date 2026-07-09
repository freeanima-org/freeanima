import type { AlertBackend, AlertContext, AlertPayload, AlertPermissionState } from "./types.ts";

let backend: AlertBackend | null = null;

export function registerAlertBackend(next: AlertBackend): void {
  backend = next;
}

export function getAlertBackend(): AlertBackend | null {
  return backend;
}

export function resetAlertBackendForTest(): void {
  backend = null;
}

function isOnSourceRoute(sourceRoute: string | undefined): boolean {
  if (!sourceRoute) return false;
  const hash = window.location.hash.replace(/^#/, "");
  const path = hash || window.location.pathname;
  return path.startsWith(sourceRoute);
}

function shouldSuppressOs(ctx?: AlertContext): boolean {
  if (!ctx?.suppressOsWhenFocused) return false;
  if (document.visibilityState !== "visible") return false;
  return isOnSourceRoute(ctx.sourceRoute);
}

/** 读取当前权限，不弹系统授权框。 */
export async function readAlertPermission(): Promise<AlertPermissionState> {
  if (backend) return backend.readPermission();
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "default";
}

export async function requestAlertPermission(): Promise<AlertPermissionState> {
  if (!backend) return "unsupported";
  return backend.requestPermission();
}

export async function deliverAlert(payload: AlertPayload, ctx?: AlertContext): Promise<void> {
  if (!backend) return;

  const suppressOs = shouldSuppressOs(ctx) || payload.silent === true;
  const effective: AlertPayload = suppressOs ? { ...payload, silent: true } : payload;

  if (effective.sound && backend.playSound) {
    backend.playSound();
  }

  if (!effective.silent) {
    await backend.show(effective);
  }
}
