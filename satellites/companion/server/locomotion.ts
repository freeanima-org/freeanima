import { existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { jsonResponse } from "./http/cors.ts";
import { companionMotionsDir } from "./paths.ts";
import { resolveFbx2gltfBinary } from "./fbx-converter-kit.ts";
import { convertFbxToVrmaFiles } from "./fbx2vrma-core.ts";
import { loadConfig, saveConfig, type CompanionConfig, type LocomotionSlot } from "./config.ts";
import { LOCOMOTION_SLOT_LABELS, LOCOMOTION_SLOTS } from "../shared/constants.ts";
import { resolveMotionFile } from "./motions.ts";

export { LOCOMOTION_SLOTS };

export type LocomotionSlotInfo = {
  slot: LocomotionSlot;
  label: string;
  file: string | null;
  available: boolean;
};

function slotOutputName(slot: LocomotionSlot): string {
  return `locomotion_${slot}.vrma`;
}

async function convertFbxToVrma(inputPath: string, outputPath: string): Promise<void> {
  const fbx2gltf = resolveFbx2gltfBinary();
  await convertFbxToVrmaFiles(inputPath, outputPath, fbx2gltf, "30");
}

export function locomotionFileForSlot(slot: LocomotionSlot): string {
  const cfg = loadConfig();
  const configured = cfg.locomotion?.[slot];
  if (configured) return configured;
  return slotOutputName(slot);
}

export function locomotionSlotStatus(): LocomotionSlotInfo[] {
  return LOCOMOTION_SLOTS.map((slot) => {
    const file = locomotionFileForSlot(slot);
    const available = resolveMotionFile(`/motions/${file}`) !== null;
    return {
      slot,
      label: LOCOMOTION_SLOT_LABELS[slot],
      file: available ? file : null,
      available,
    };
  });
}

export function locomotionConfigForClient(): Record<LocomotionSlot, string | null> {
  const out = {} as Record<LocomotionSlot, string | null>;
  for (const info of locomotionSlotStatus()) {
    out[info.slot] = info.available ? info.file : null;
  }
  return out;
}

export async function importLocomotionFile(
  slot: LocomotionSlot,
  uploadName: string,
  bytes: Uint8Array,
): Promise<{ slot: LocomotionSlot; file: string }> {
  if (!LOCOMOTION_SLOTS.includes(slot)) {
    throw new Error(`未知槽位: ${slot}`);
  }

  const lower = uploadName.toLowerCase();
  if (!lower.endsWith(".fbx") && !lower.endsWith(".vrma")) {
    throw new Error("仅支持 .fbx 或 .vrma");
  }

  mkdirSync(companionMotionsDir(), { recursive: true });
  const destName = slotOutputName(slot);
  const destPath = join(companionMotionsDir(), destName);
  const tempDir = join(companionMotionsDir(), ".locomotion-import");
  mkdirSync(tempDir, { recursive: true });

  const tempInput = join(tempDir, basename(uploadName));
  await Bun.write(tempInput, bytes);

  try {
    if (lower.endsWith(".fbx")) {
      await convertFbxToVrma(tempInput, destPath);
    } else {
      await Bun.write(destPath, bytes);
    }
  } finally {
    await removeTree(tempDir);
  }

  const patch: Partial<CompanionConfig> = {
    locomotion: {
      ...loadConfig().locomotion,
      [slot]: destName,
    },
  };
  saveConfig(patch);

  return { slot, file: destName };
}

export async function clearLocomotionSlot(slot: LocomotionSlot): Promise<void> {
  const cfg = loadConfig();
  const next = { ...cfg.locomotion };
  delete next[slot];
  saveConfig({ locomotion: Object.keys(next).length > 0 ? next : {} });

  const file = slotOutputName(slot);
  const path = join(companionMotionsDir(), file);
  if (existsSync(path)) {
    await removeTree(path);
  }
}

async function removeTree(path: string): Promise<void> {
  if (process.platform === "win32") {
    await Bun.spawn([
      "powershell",
      "-NoProfile",
      "-Command",
      `Remove-Item -LiteralPath '${path.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue`,
    ]).exited;
    return;
  }
  await Bun.spawn(["rm", "-rf", path]).exited;
}

export async function handleLocomotionImport(
  req: Request,
  slot: LocomotionSlot,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonResponse({ error: "无效的 multipart 请求" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonResponse({ error: "缺少 file 字段" }, 400);
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await importLocomotionFile(slot, file.name, bytes);
    return jsonResponse(result);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
}
