import { describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installBinDir, resolveFbx2gltfBinary, sidecarRuntimeDir } from "./fbx-converter-kit.ts";

describe("fbx-converter-kit", () => {
  it("安装目录找 FBX2glTF；sidecar 资源根含 node_modules", () => {
    const bin = join(tmpdir(), `companion-fbx-kit-${Date.now()}`);
    const runtime = join(bin, "resources", "sidecar");
    mkdirSync(join(runtime, "node_modules", "fbx2vrma-converter"), { recursive: true });
    const fbx2gltfName =
      process.platform === "win32"
        ? "FBX2glTF-windows-x64.exe"
        : process.platform === "darwin"
          ? "FBX2glTF-darwin-x64"
          : "FBX2glTF-linux-x64";

    writeFileSync(join(bin, fbx2gltfName), "");
    writeFileSync(join(runtime, "node_modules", "fbx2vrma-converter", "fbx2vrma-converter.js"), "");

    const prevExec = process.execPath;
    const prevBinDir = process.env.COMPANION_BIN_DIR;
    const prevDir = import.meta.dir;
    Object.defineProperty(process, "execPath", {
      value: join(bin, process.platform === "win32" ? "companion.exe" : "companion"),
    });
    process.env.COMPANION_BIN_DIR = bin;

    try {
      expect(installBinDir()).toBe(bin);
      expect(resolveFbx2gltfBinary()).toBe(join(bin, fbx2gltfName));
      expect(sidecarRuntimeDir()).toBe(join(prevDir, ".."));
    } finally {
      Object.defineProperty(process, "execPath", { value: prevExec });
      if (prevBinDir === undefined) {
        delete process.env.COMPANION_BIN_DIR;
      } else {
        process.env.COMPANION_BIN_DIR = prevBinDir;
      }
    }
  });
});
