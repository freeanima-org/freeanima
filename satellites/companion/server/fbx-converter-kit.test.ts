import { describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveFbx2gltfBinary, resolveFbx2vrmaCli } from "./fbx-converter-kit.ts";

describe("fbx-converter-kit", () => {
  it("优先使用 sidecar 同目录的 fbx2vrma 与 FBX2glTF，无需 node_modules 工具包", () => {
    const bin = join(tmpdir(), `companion-fbx-kit-${Date.now()}`);
    mkdirSync(bin, { recursive: true });
    const sidecarExt = process.platform === "win32" ? ".exe" : "";
    const fbx2gltfName =
      process.platform === "win32"
        ? "FBX2glTF-windows-x64.exe"
        : process.platform === "darwin"
          ? "FBX2glTF-darwin-x64"
          : "FBX2glTF-linux-x64";

    writeFileSync(join(bin, `companion-sidecar${sidecarExt}`), "");
    writeFileSync(join(bin, `fbx2vrma${sidecarExt}`), "");
    writeFileSync(join(bin, fbx2gltfName), "");

    const prevExec = process.execPath;
    Object.defineProperty(process, "execPath", {
      value: join(bin, `companion-sidecar${sidecarExt}`),
    });

    try {
      expect(resolveFbx2vrmaCli()).toBe(join(bin, `fbx2vrma${sidecarExt}`));
      expect(resolveFbx2gltfBinary()).toBe(join(bin, fbx2gltfName));
    } finally {
      Object.defineProperty(process, "execPath", { value: prevExec });
    }
  });
});
