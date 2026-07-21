import { existsSync } from "node:fs";
import { join } from "node:path";
import { habitatRpcRestPrefix } from "@freeanima/shared/habitat-rpc";
import type { CompanionClientConfigPayload } from "@freeanima/shared/sap-contract/frames/companion";
import { activeModelPath, hubUrlFromEnv, loadCompanionConfig } from "./config.ts";
import { fbxImportAvailable } from "./fbx-converter-kit.ts";
import { isModelPathAvailable } from "./model-path.ts";
import { scanModelsOnDisk } from "./model-registry.ts";
import { syncLibraryFromDisk } from "./motion-library.ts";
import { companionModelsDir, companionMotionsDir } from "./paths.ts";

export async function buildClientCompanionConfig(): Promise<CompanionClientConfigPayload> {
  await scanModelsOnDisk();
  await syncLibraryFromDisk();
  const cfg = await loadCompanionConfig();
  const model_path = activeModelPath(cfg);
  return {
    ...cfg,
    habitat_url: hubUrlFromEnv(),
    hub_url: hubUrlFromEnv(),
    model_path,
    model_available: isModelPathAvailable(model_path),
    fbx_import_available: fbxImportAvailable(),
  };
}

export function companionAssetUrl(
  kind: "models" | "motions",
  fileName: string,
  hubBase: string,
): string {
  const base = hubBase.replace(/\/$/, "");
  return `${base}${habitatRpcRestPrefix()}/companion/assets/${kind}/${encodeURIComponent(fileName)}`;
}

export function listAssetDownloadUrls(
  _hubBase: string,
  cfg: Awaited<ReturnType<typeof loadCompanionConfig>>,
): string[] {
  const urls: string[] = [];
  for (const model of cfg.models) {
    const fileName = model.path.replace(/^\/models\//, "");
    if (fileName)
      urls.push(
        `${habitatRpcRestPrefix()}/companion/assets/models/${encodeURIComponent(fileName)}`,
      );
  }
  for (const motion of cfg.motion_library) {
    if (motion.file) {
      urls.push(
        `${habitatRpcRestPrefix()}/companion/assets/motions/${encodeURIComponent(motion.file)}`,
      );
    }
  }
  return urls;
}

export function resolveAssetFilePath(kind: "models" | "motions", fileName: string): string | null {
  const safe = fileName.replace(/[/\\]/g, "");
  if (!safe || safe !== fileName) return null;
  const dir = kind === "models" ? companionModelsDir() : companionMotionsDir();
  const path = join(dir, safe);
  return existsSync(path) ? path : null;
}
