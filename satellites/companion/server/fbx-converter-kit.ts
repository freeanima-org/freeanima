import { dirname, join } from "node:path";
import { FBX_IMPORT_UNAVAILABLE_MSG } from "../shared/constants.ts";
import { companionPackageRoot } from "./companion-root.ts";
import { fbx2gltfCacheDir, platformBinaryNames, verifyFbx2gltfBinary } from "./fbx2gltf-shared.ts";

export { FBX_IMPORT_UNAVAILABLE_MSG };

/** Electron 打包后 extraResources/bin；开发期与 electron 可执行文件同级 */
export function installBinDir(): string {
  const fromEnv = process.env.COMPANION_BIN_DIR?.trim();
  if (fromEnv) return fromEnv;
  const resources = process.env.COMPANION_RESOURCES_PATH?.trim();
  if (resources) return join(resources, "bin");
  return dirname(process.execPath);
}

/** sidecar 资源根（含 server/、node_modules/） */
export function sidecarRuntimeDir(): string {
  return companionPackageRoot();
}

function devCompanionRoot(): string {
  return join(companionPackageRoot(), "..");
}

function kitDirCandidates(): string[] {
  return [
    join(sidecarRuntimeDir(), "node_modules", "fbx2vrma-converter"),
    join(devCompanionRoot(), "node_modules", "fbx2vrma-converter"),
  ];
}

function fbx2gltfCandidates(): string[] {
  const names = platformBinaryNames();
  const paths: string[] = [];

  const cacheDir = fbx2gltfCacheDir();
  for (const name of names) {
    paths.push(join(cacheDir, name));
  }

  const bin = installBinDir();
  for (const name of names) {
    paths.push(join(bin, name));
  }
  for (const dir of kitDirCandidates()) {
    for (const name of names) {
      paths.push(join(dir, name));
    }
  }
  return paths;
}

export function findFbx2gltfBinary(): string | null {
  for (const path of fbx2gltfCandidates()) {
    if (verifyFbx2gltfBinary(path)) {
      return path;
    }
  }
  return null;
}

export function fbxImportAvailable(): boolean {
  return findFbx2gltfBinary() !== null;
}

export function resolveFbx2gltfBinary(): string {
  const path = findFbx2gltfBinary();
  if (path) return path;
  throw new Error(FBX_IMPORT_UNAVAILABLE_MSG);
}
