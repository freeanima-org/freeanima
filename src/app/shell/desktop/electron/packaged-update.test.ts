import { afterEach, describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { removeTempDir } from "@freeanima/core/util/temp-dir";

import {
  createInstallerTempPath,
  launchWindowsNsisInstaller,
  parsePackagedUpdatePayload,
  verifyDownloadedInstaller,
  type SpawnLike,
} from "./packaged-update.ts";

function writePeStub(filePath: string, size = 64): void {
  const buf = Buffer.alloc(size, 0);
  buf[0] = 0x4d;
  buf[1] = 0x5a;
  writeFileSync(filePath, buf);
}

describe("parsePackagedUpdatePayload", () => {
  it("接受 legacy 字符串 URL", () => {
    expect(parsePackagedUpdatePayload("https://example.com/setup.exe")).toEqual({
      assetUrl: "https://example.com/setup.exe",
    });
  });

  it("接受带 expectedSize 的对象", () => {
    expect(
      parsePackagedUpdatePayload({
        assetUrl: "https://example.com/setup.exe",
        expectedSize: 12345,
      }),
    ).toEqual({
      assetUrl: "https://example.com/setup.exe",
      expectedSize: 12345,
    });
  });

  it("拒绝非 https URL", () => {
    expect(() => parsePackagedUpdatePayload({ assetUrl: "http://x" })).toThrow(/无效的安装包 URL/);
  });
});

describe("verifyDownloadedInstaller", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) {
      removeTempDir(tempDir);
      tempDir = "";
    }
  });

  it("通过有效 PE 与匹配大小", () => {
    tempDir = mkdtempSync(join(tmpdir(), "packaged-update-test-"));
    const file = join(tempDir, "setup.exe");
    writePeStub(file, 100);
    expect(() => verifyDownloadedInstaller(file, 100)).not.toThrow();
  });

  it("拒绝大小不符", () => {
    tempDir = mkdtempSync(join(tmpdir(), "packaged-update-test-"));
    const file = join(tempDir, "setup.exe");
    writePeStub(file, 100);
    expect(() => verifyDownloadedInstaller(file, 200)).toThrow(/安装包大小不符/);
  });

  it("拒绝非 PE 头", () => {
    tempDir = mkdtempSync(join(tmpdir(), "packaged-update-test-"));
    const file = join(tempDir, "setup.exe");
    writeFileSync(file, "<html></html>");
    expect(() => verifyDownloadedInstaller(file)).toThrow(/不是有效的 Windows 可执行文件/);
  });
});

describe("createInstallerTempPath", () => {
  it("在 temp 下生成唯一路径", () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-update-root-"));
    try {
      const a = createInstallerTempPath(root);
      const b = createInstallerTempPath(root);
      expect(a).not.toBe(b);
      expect(a).toContain("freeanima-desktop-update-");
      expect(a.endsWith("freeanima-desktop-windows-x64-setup.exe")).toBe(true);
    } finally {
      removeTempDir(root);
    }
  });
});

describe("launchWindowsNsisInstaller", () => {
  it("cmd start 成功时返回 pid", async () => {
    const fakeChild = new EventEmitter() as EventEmitter & { pid?: number; unref: () => void };
    fakeChild.pid = 4242;
    fakeChild.unref = () => {};

    const spawnImpl: SpawnLike = () => {
      queueMicrotask(() => fakeChild.emit("spawn"));
      return fakeChild as ReturnType<SpawnLike>;
    };

    const pid = await launchWindowsNsisInstaller("C:\\Temp\\setup.exe", { spawnImpl });
    expect(pid).toBe(4242);
  });

  it("spawn error 时 reject", async () => {
    const fakeChild = new EventEmitter() as EventEmitter & { unref: () => void };
    fakeChild.unref = () => {};

    const spawnImpl: SpawnLike = () => {
      queueMicrotask(() => fakeChild.emit("error", new Error("EACCES")));
      return fakeChild as ReturnType<SpawnLike>;
    };

    await expect(
      launchWindowsNsisInstaller("C:\\Temp\\setup.exe", {
        spawnImpl,
        timeoutMs: 100,
      }),
    ).rejects.toThrow(/无法启动安装程序/);
  });
});
