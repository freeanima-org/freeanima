import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { displayNameFromFilename, motionFileNameForId, newMotionId } from "./asset-id.ts";
import type { MotionLibraryEntry } from "./types.ts";
import { companionMotionsDir } from "./paths.ts";
import { FBX_IMPORT_UNAVAILABLE_MSG, findFbx2gltfBinary } from "./fbx-converter-kit.ts";
import { ensureFbx2gltf } from "./fbx2gltf-install.ts";
import { convertFbxToVrmaFiles } from "./fbx2vrma-core.ts";
import { loadCompanionConfig, saveCompanionConfig } from "./config.ts";
import { extractZipArchive, readBytes, removePath, writeBytes } from "./process-utils.ts";

const MOTION_EXT = /\.(vrma|fbx)$/i;

async function registerMotionEntry(entry: MotionLibraryEntry): Promise<MotionLibraryEntry> {
  const cfg = await loadCompanionConfig();
  const existing = cfg.motion_library.find((e) => e.id === entry.id);
  if (existing) return existing;
  await saveCompanionConfig({ motion_library: [...cfg.motion_library, entry] });
  return entry;
}

export type MotionImportResult = {
  dir: string;
  files: string[];
  entries: MotionLibraryEntry[];
  skipped_fbx?: string[];
};

export function sanitizeMotionBaseName(name: string): string {
  const base = basename(name).replace(/\.[^.]+$/, "");
  return (
    base
      .replace(/[^\w.\-()+ ]+/g, "_")
      .replace(/\s+/g, "_")
      .trim() || "motion"
  );
}

async function fbxImportReady(): Promise<boolean> {
  if (findFbx2gltfBinary()) return true;
  return ensureFbx2gltf();
}

async function convertFbxToVrma(inputPath: string, outputPath: string): Promise<void> {
  if (!(await fbxImportReady())) {
    throw new Error(FBX_IMPORT_UNAVAILABLE_MSG);
  }
  const fbx2gltf = findFbx2gltfBinary();
  if (!fbx2gltf) {
    throw new Error(FBX_IMPORT_UNAVAILABLE_MSG);
  }
  await convertFbxToVrmaFiles(inputPath, outputPath, fbx2gltf, "30");
}

function collectMotionFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const st = statSync(path);
      if (st.isDirectory()) {
        walk(path);
        continue;
      }
      if (MOTION_EXT.test(entry)) {
        found.push(path);
      }
    }
  };
  walk(root);
  return found;
}

async function importVrmaBytes(
  destDir: string,
  bytes: Uint8Array,
  uploadName: string,
): Promise<MotionLibraryEntry> {
  const id = newMotionId();
  const fileName = motionFileNameForId(id);
  await writeBytes(join(destDir, fileName), bytes);
  return registerMotionEntry({
    id,
    name: displayNameFromFilename(uploadName),
    file: fileName,
  });
}

async function importFbxFile(
  destDir: string,
  inputPath: string,
  uploadName: string,
): Promise<MotionLibraryEntry> {
  const id = newMotionId();
  const fileName = motionFileNameForId(id);
  const destPath = join(destDir, fileName);
  await convertFbxToVrma(inputPath, destPath);
  return registerMotionEntry({
    id,
    name: displayNameFromFilename(uploadName),
    file: fileName,
  });
}

/** 将单个 .vrma / .fbx 或含 vrma/fbx 的 zip 导入到扁平 motions 目录 */
export async function importMotionUpload(
  uploadName: string,
  bytes: Uint8Array,
): Promise<MotionImportResult> {
  const destDir = companionMotionsDir();
  mkdirSync(destDir, { recursive: true });
  const lower = uploadName.toLowerCase();
  const imported: MotionLibraryEntry[] = [];
  const skippedFbx: string[] = [];
  const tryFbxImport = (): Promise<boolean> => fbxImportReady();

  if (lower.endsWith(".zip")) {
    const tempDir = join(destDir, ".import-tmp");
    const zipPath = join(tempDir, "upload.zip");
    mkdirSync(tempDir, { recursive: true });
    try {
      await writeBytes(zipPath, bytes);
      const extractRoot = join(tempDir, "extract");
      mkdirSync(extractRoot, { recursive: true });
      await extractZipArchive(zipPath, extractRoot);
      const sources = collectMotionFiles(extractRoot);
      if (sources.length === 0) {
        throw new Error("ZIP 中未找到 .vrma 或 .fbx 文件");
      }
      for (const src of sources) {
        const name = basename(src);
        if (name.toLowerCase().endsWith(".vrma")) {
          const data = await readBytes(src);
          imported.push(await importVrmaBytes(destDir, data, name));
        } else if (!(await tryFbxImport())) {
          skippedFbx.push(name);
        } else {
          imported.push(await importFbxFile(destDir, src, name));
        }
      }
      if (imported.length === 0 && skippedFbx.length > 0) {
        throw new Error(FBX_IMPORT_UNAVAILABLE_MSG);
      }
    } finally {
      await removePath(tempDir);
    }
  } else if (lower.endsWith(".vrma")) {
    imported.push(await importVrmaBytes(destDir, bytes, uploadName));
  } else if (lower.endsWith(".fbx")) {
    if (!(await tryFbxImport())) {
      throw new Error(FBX_IMPORT_UNAVAILABLE_MSG);
    }
    const tempDir = join(destDir, ".import-tmp");
    mkdirSync(tempDir, { recursive: true });
    const tempInput = join(tempDir, basename(uploadName));
    try {
      await writeBytes(tempInput, bytes);
      imported.push(await importFbxFile(destDir, tempInput, uploadName));
    } finally {
      await removePath(tempDir);
    }
  } else {
    throw new Error("仅支持 .vrma、.fbx 或 .zip");
  }

  const uniqueEntries = [...new Map(imported.map((e) => [e.id, e])).values()];

  return {
    dir: destDir,
    files: uniqueEntries.map((e) => e.file),
    entries: uniqueEntries,
    ...(skippedFbx.length > 0 ? { skipped_fbx: skippedFbx } : {}),
  };
}
