import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** sidecar 可执行文件所在目录（Tauri 安装后与 companion-shell 同级） */
export function sidecarBinDir(): string {
  return dirname(process.execPath);
}

function devKitDir(): string {
  return join(import.meta.dir, "..", "node_modules", "fbx2vrma-converter");
}

function kitDirCandidates(): string[] {
  return [join(sidecarBinDir(), "fbx2vrma-converter"), devKitDir()];
}

/** 开发期 node_modules 内的 JS 脚本目录 */
export function resolveFbxConverterKitDir(): string {
  for (const dir of kitDirCandidates()) {
    if (existsSync(join(dir, "fbx2vrma-converter.js"))) {
      return dir;
    }
  }
  throw new Error("未找到 FBX 转换工具包。请重新编译 sidecar，或直接导入 .vrma 文件。");
}

/** 已编译 fbx2vrma.exe，或开发期 node_modules 内 JS 脚本 */
export function resolveFbx2vrmaCli(): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  const compiled = join(sidecarBinDir(), `fbx2vrma${ext}`);
  if (existsSync(compiled)) {
    return compiled;
  }
  return join(resolveFbxConverterKitDir(), "fbx2vrma-converter.js");
}

function fbx2gltfCandidates(): string[] {
  const bin = sidecarBinDir();
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

export function resolveFbx2gltfBinary(): string {
  for (const path of fbx2gltfCandidates()) {
    if (existsSync(path)) {
      return path;
    }
  }
  throw new Error(
    "未找到 FBX2glTF 二进制（需与 companion-sidecar.exe 同目录的 FBX2glTF-windows-x64.exe）。请重新安装或改用 .vrma 导入。",
  );
}
