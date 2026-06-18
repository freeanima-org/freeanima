import { isTauri } from "./tauri.ts";
import { resolveSidecarOrigin } from "./sidecar.ts";
import type { LocomotionSlot } from "@shared/constants.ts";

let sidecarOrigin: string | null = null;

async function origin(): Promise<string> {
  if (!sidecarOrigin) {
    sidecarOrigin = await resolveSidecarOrigin();
  }
  return sidecarOrigin;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await origin();
  const res = await fetch(`${base}${path}`, init);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export type CompanionConfig = {
  app_id: string;
  instance_id: string;
  hub_url: string;
  model_path: string;
  model_available: boolean;
  locomotion?: Partial<Record<LocomotionSlot, string>>;
};

export async function fetchCompanionConfig(): Promise<CompanionConfig> {
  return apiJson<CompanionConfig>("/api/config");
}

export async function saveSettings(patch: { hub_url?: string; model_path?: string }) {
  return apiJson<CompanionConfig>("/api/config", {
    method: "POST",
    body: JSON.stringify(patch),
    headers: { "Content-Type": "application/json" },
  });
}

export async function uploadModel(file: File) {
  const base = await origin();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${base}/api/models/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as { model_path: string; filename: string };
}

export type MotionStatus = {
  ready: boolean;
  user_dir: string;
  required: string[];
  booth_url: string;
  auto_download_configured: boolean;
};

export async function fetchMotionStatus() {
  return apiJson<MotionStatus>("/api/motions/status");
}

export async function uploadMotionZip(file: File) {
  const base = await origin();
  const form = new FormData();
  form.append("file", file);
  let res: Response;
  try {
    res = await fetch(`${base}/api/motions/import`, { method: "POST", body: form });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      msg.includes("fetch") || msg.includes("Fetch")
        ? "无法连接伴侣后台（请确认 sidecar 已启动，或稍后重试）"
        : msg,
    );
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as { ok: true; dir: string; files: string[] };
}

export type { LocomotionSlot } from "@shared/constants.ts";

export type LocomotionSlotInfo = {
  slot: LocomotionSlot;
  label: string;
  file: string | null;
  available: boolean;
};

export type LocomotionStatus = {
  slots: LocomotionSlotInfo[];
  configured: Record<LocomotionSlot, string | null>;
  user_dir: string;
};

export async function fetchLocomotionStatus() {
  return apiJson<LocomotionStatus>("/api/motions/locomotion");
}

export async function uploadLocomotionMotion(slot: LocomotionSlot, file: File) {
  const base = await origin();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${base}/api/motions/locomotion/${slot}/import`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as { slot: LocomotionSlot; file: string };
}

export async function clearLocomotionMotion(slot: LocomotionSlot) {
  return apiJson<{ ok: true; slots: LocomotionSlotInfo[] }>("/api/motions/locomotion/clear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot }),
  });
}

export async function downloadMotionsFromMirror() {
  return apiJson<{ ok: true; dir: string; files: string[] }>("/api/motions/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export { isTauri };
