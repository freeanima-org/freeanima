import { describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { companionRuntimeDir, installBinDir, resolveFbx2gltfBinary } from "./fbx-converter-kit.ts";
import { fbx2gltfBinaryName } from "./fbx2gltf-shared.ts";

describe("fbx-converter-kit", () => {
  it("安装目录找 FBX2glTF；companion 资源根含 node_modules", () => {
    const bin = join(tmpdir(), `companion-fbx-kit-${Date.now()}`);
    const runtime = join(bin, "resources", "companion");
    mkdirSync(join(runtime, "node_modules", "fbx2vrma-converter"), { recursive: true });
    const fbx2gltfName =
      process.platform === "win32"
        ? "FBX2glTF-windows-x64.exe"
        : process.platform === "darwin"
          ? "FBX2glTF-darwin-x64"
          : "FBX2glTF-linux-x64";

    writeFileSync(join(bin, fbx2gltfName), Buffer.alloc(2_000_000));
    writeFileSync(join(runtime, "node_modules", "fbx2vrma-converter", "fbx2vrma-converter.js"), "");

    const prevExec = process.execPath;
    const prevHome = process.env.FREEANIMA_HOME;
    process.env.FREEANIMA_HOME = join(tmpdir(), `companion-fbx-empty-${Date.now()}`);
    const prevBinDir = process.env.COMPANION_BIN_DIR;
    const prevDir = import.meta.dir;
    Object.defineProperty(process, "execPath", {
      value: join(bin, process.platform === "win32" ? "companion.exe" : "companion"),
    });
    process.env.COMPANION_BIN_DIR = bin;

    try {
      expect(installBinDir()).toBe(bin);
      expect(resolveFbx2gltfBinary()).toBe(join(bin, fbx2gltfName));
      expect(companionRuntimeDir()).toBe(join(prevDir, ".."));
    } finally {
      if (prevHome === undefined) {
        delete process.env.FREEANIMA_HOME;
      } else {
        process.env.FREEANIMA_HOME = prevHome;
      }
      Object.defineProperty(process, "execPath", { value: prevExec });
      if (prevBinDir === undefined) {
        delete process.env.COMPANION_BIN_DIR;
      } else {
        process.env.COMPANION_BIN_DIR = prevBinDir;
      }
    }
  });

  it("优先从 FREEANIMA_HOME/tools/fbx2gltf 解析二进制", () => {
    const binaryName = fbx2gltfBinaryName();
    if (!binaryName) return;

    const home = join(tmpdir(), `companion-fbx-cache-${Date.now()}`);
    const cacheDir = join(home, "tools", "fbx2gltf");
    mkdirSync(cacheDir, { recursive: true });
    const cacheBinary = join(cacheDir, binaryName);
    writeFileSync(cacheBinary, Buffer.alloc(2_000_000));

    const prevHome = process.env.FREEANIMA_HOME;
    process.env.FREEANIMA_HOME = home;
    try {
      expect(resolveFbx2gltfBinary()).toBe(cacheBinary);
    } finally {
      if (prevHome === undefined) {
        delete process.env.FREEANIMA_HOME;
      } else {
        process.env.FREEANIMA_HOME = prevHome;
      }
    }
  });
});
