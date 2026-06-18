import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { FBX_IMPORT_UNAVAILABLE_MSG } from "../shared/constants.ts";

export { FBX_IMPORT_UNAVAILABLE_MSG };

/** 安装目录（companion-bun.exe / FBX2glTF 与 shell 同级） */
export function installBinDir(): string {
  return dirname(process.execPath);
}

/** sidecar 资源根（含 server/、node_modules/） */
export function sidecarRuntimeDir(): string {
  return join(import.meta.dir, "..");
}

function devCompanionRoot(): string {
  return join(import.meta.dir, "..", "..");
}

function kitDirCandidates(): string[] {
  return [
    join(sidecarRuntimeDir(), "node_modules", "fbx2vrma-converter"),
    join(devCompanionRoot(), "node_modules", "fbx2vrma-converter"),
  ];
}

function fbx2gltfCandidates(): string[] {
  const bin = installBinDir();
  const names: string[] = [];
  if (process.platform === "win32") {
    names.push("FBX2glTF-windows-x64.exe");
  } else if (process.platform === "darwin") {
    names.push("FBX2glTF-darwin-x64", "FBX2glTF-darwin-arm64");
  } else {
    names.push("FBX2glTF-linux-x64");
  }

  const paths: string[] = [];
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
    if (existsSync(path)) {
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
