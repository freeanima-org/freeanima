import { isTauri } from "./tauri.ts";
import { resolveSidecarOrigin } from "./sidecar.ts";
import type {
  ClientCompanionConfig,
  LocomotionSlot,
  MotionLibraryEntry,
  MotionSlotId,
  PlaySlotCommand,
  RuntimeState,
} from "@shared/constants.ts";
import type { CompanionBehavior } from "@shared/companion-schema.ts";

let sidecarOrigin: string | null = null;

export function resetSidecarOriginCache(): void {
  sidecarOrigin = null;
}

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

export type CompanionConfig = ClientCompanionConfig;

export async function fetchCompanionConfig(): Promise<CompanionConfig> {
  return apiJson<CompanionConfig>("/api/config");
}

export async function saveSettings(patch: {
  hub_url?: string;
  behavior?: Partial<CompanionBehavior>;
  motion_slots?: ClientCompanionConfig["motion_slots"];
}) {
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
  return (await res.json()) as { model: { id: string; path: string }; config: CompanionConfig };
}

export async function setActiveModel(id: string) {
  return apiJson<{ model: { id: string; path: string }; config: CompanionConfig }>(
    "/api/models/active",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    },
  );
}

export async function renameModel(id: string, name: string) {
  return apiJson<{ model: { id: string; name: string } }>("/api/models/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name }),
  });
}

export async function deleteModel(id: string) {
  return apiJson<{ config: CompanionConfig }>("/api/models/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
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

export type LocomotionStatus = {
  library: MotionLibraryEntry[];
  slots: ClientCompanionConfig["motion_slots"];
  user_dir: string;
};

export async function fetchLocomotionStatus() {
  return apiJson<LocomotionStatus>("/api/motions/locomotion");
}

export async function fetchMotionLibrary() {
  return apiJson<{ library: MotionLibraryEntry[]; slots: ClientCompanionConfig["motion_slots"] }>(
    "/api/motions/library",
  );
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

export async function setMotionSlot(slot: MotionSlotId, motionIds: string[]) {
  return apiJson<{ config: CompanionConfig }>("/api/motions/slots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot, motion_ids: motionIds }),
  });
}

export async function renameMotion(id: string, name: string) {
  return apiJson<{ entry: MotionLibraryEntry }>("/api/motions/library/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name }),
  });
}

export async function deleteMotion(id: string) {
  return apiJson<{ library: MotionLibraryEntry[]; config: CompanionConfig }>(
    "/api/motions/library/delete",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    },
  );
}

export async function downloadMotionsFromMirror() {
  return apiJson<{ ok: true; dir: string; files: string[] }>("/api/motions/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export async function fetchRuntimeState(): Promise<RuntimeState> {
  return apiJson<RuntimeState>("/api/runtime");
}

export async function advanceBubble() {
  return apiJson<{ current: { id: string; text: string } | null }>("/api/bubbles/advance", {
    method: "POST",
  });
}

export type { PlaySlotCommand, RuntimeState, MotionLibraryEntry, MotionSlotId };

export { isTauri };
