import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FBX_IMPORT_UNAVAILABLE_MSG } from "./types.ts";
import { fbx2gltfCacheDir, platformBinaryNames, verifyFbx2gltfBinary } from "./fbx2gltf-shared.ts";

export { FBX_IMPORT_UNAVAILABLE_MSG };

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "..", "..");
}

function kitDirCandidates(): string[] {
  return [join(repoRoot(), "node_modules", "fbx2vrma-converter")];
}

function fbx2gltfCandidates(): string[] {
  const names = platformBinaryNames();
  const paths: string[] = [];
  const cacheDir = fbx2gltfCacheDir();
  for (const name of names) {
    paths.push(join(cacheDir, name));
  }
  for (const dir of kitDirCandidates()) {
    for (const name of names) {
      paths.push(join(dir, name));
    }
  }
  const home = process.env.FREEANIMA_HOME?.trim() || join(homedir(), ".anima");
  for (const name of names) {
    paths.push(join(home, "tools", "fbx2gltf", name));
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
  return findFbx2gltfBinary() != null;
}

export function resolveFbx2gltfBinary(): string {
  const path = findFbx2gltfBinary();
  if (path) return path;
  throw new Error(FBX_IMPORT_UNAVAILABLE_MSG);
}
