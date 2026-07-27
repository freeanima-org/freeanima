import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { createObjectFile } from "@freeanima/features/object-storage/domain";
import { displayNameFromFilename } from "./asset-id.ts";
import type { MotionLibraryEntry } from "./types.ts";
import { companionMotionsDir } from "./paths.ts";
import { FBX_IMPORT_UNAVAILABLE_MSG, findFbx2gltfBinary } from "./fbx-converter-kit.ts";
import { ensureFbx2gltf } from "./fbx2gltf-install.ts";
import { convertFbxToVrmaFiles } from "./fbx2vrma-core.ts";
import { resolveCompanionWorldId } from "./companion-world.ts";
import { nextMotionSort, registerMotionEntry } from "./motion-library.ts";
import { extractZipArchive, readBytes, removePath, writeBytes } from "./process-utils.ts";

const MOTION_EXT = /\.(vrma|fbx)$/i;

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

async function putMotionAsObjectFile(bytes: Uint8Array, title: string): Promise<number> {
  const file = await createObjectFile({
    world_id: resolveCompanionWorldId(),
    title,
    bytes,
    mime_type: "application/octet-stream",
  });
  return file.id;
}

async function importVrmaBytes(
  bytes: Uint8Array,
  uploadName: string,
  sort: number,
): Promise<MotionLibraryEntry> {
  const name = displayNameFromFilename(uploadName);
  const object_file_id = await putMotionAsObjectFile(bytes, name);
  return registerMotionEntry({ name, object_file_id, sort });
}

async function importFbxFile(
  destDir: string,
  inputPath: string,
  uploadName: string,
  sort: number,
): Promise<MotionLibraryEntry> {
  const destPath = join(destDir, `.tmp-${Date.now()}.vrma`);
  await convertFbxToVrma(inputPath, destPath);
  const bytes = await readBytes(destPath);
  const name = displayNameFromFilename(uploadName);
  const object_file_id = await putMotionAsObjectFile(bytes, name);
  await removePath(destPath);
  return registerMotionEntry({ name, object_file_id, sort });
}

/** 将单个 .vrma / .fbx 或含 vrma/fbx 的 zip 导入 */
export async function importMotionUpload(
  uploadName: string,
  bytes: Uint8Array,
): Promise<MotionImportResult> {
  const destDir = companionMotionsDir();
  mkdirSync(destDir, { recursive: true });
  const lower = uploadName.toLowerCase();
  const imported: MotionLibraryEntry[] = [];
  const skippedFbx: string[] = [];
  let sort = await nextMotionSort();

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
          imported.push(await importVrmaBytes(data, name, sort));
          sort += 1;
        } else if (!(await fbxImportReady())) {
          skippedFbx.push(name);
        } else {
          imported.push(await importFbxFile(destDir, src, name, sort));
          sort += 1;
        }
      }
      if (imported.length === 0 && skippedFbx.length > 0) {
        throw new Error(FBX_IMPORT_UNAVAILABLE_MSG);
      }
    } finally {
      await removePath(tempDir);
    }
  } else if (lower.endsWith(".vrma")) {
    imported.push(await importVrmaBytes(bytes, uploadName, sort));
  } else if (lower.endsWith(".fbx")) {
    if (!(await fbxImportReady())) {
      throw new Error(FBX_IMPORT_UNAVAILABLE_MSG);
    }
    const tempDir = join(destDir, ".import-tmp");
    mkdirSync(tempDir, { recursive: true });
    const tempInput = join(tempDir, basename(uploadName));
    try {
      await writeBytes(tempInput, bytes);
      imported.push(await importFbxFile(destDir, tempInput, uploadName, sort));
    } finally {
      await removePath(tempDir);
    }
  } else {
    throw new Error("仅支持 .vrma、.fbx 或 .zip");
  }

  const uniqueEntries = [...new Map(imported.map((e) => [e.object_file_id, e])).values()];

  return {
    dir: destDir,
    files: uniqueEntries.map((e) => String(e.object_file_id)),
    entries: uniqueEntries,
    ...(skippedFbx.length > 0 ? { skipped_fbx: skippedFbx } : {}),
  };
}
