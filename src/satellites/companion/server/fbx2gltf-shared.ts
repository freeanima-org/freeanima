import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function fbx2gltfCacheDir(): string {
  const home = process.env.FREEANIMA_HOME?.trim() || join(homedir(), ".anima");
  return join(home, "tools", "fbx2gltf");
}

export function fbx2gltfBinaryName(): string | null {
  switch (process.platform) {
    case "win32":
      return "FBX2glTF-windows-x64.exe";
    case "darwin":
      return process.arch === "arm64" ? "FBX2glTF-darwin-arm64" : "FBX2glTF-darwin-x64";
    case "linux":
      return "FBX2glTF-linux-x64";
    default:
      return null;
  }
}

export function platformBinaryNames(): string[] {
  const current = fbx2gltfBinaryName();
  if (!current) return [];
  if (process.platform === "darwin") {
    return ["FBX2glTF-darwin-x64", "FBX2glTF-darwin-arm64"];
  }
  return [current];
}

export function verifyFbx2gltfBinary(path: string): boolean {
  if (!existsSync(path)) return false;
  return statSync(path).size > 1_000_000;
}
