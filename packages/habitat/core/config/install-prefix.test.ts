import { describe, expect, it } from "bun:test";
import { chmodSync, mkdirSync, readlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createTempDir, removeTempDir } from "@freeanima/habitat/core/util/temp-dir";
import {
  assertSafeStandaloneInstallPrefix,
  defaultAnimaBinDir,
  defaultStandaloneInstallPrefix,
  getCurrentVersionId,
  installVersionedBinary,
  isPathInsideMonorepo,
  listInstalledVersions,
  migrateFlatAnimaFileIfNeeded,
  normalizeVersionFileId,
  pruneVersionedBinaries,
  resolveInstallPrefixFromEnv,
  setCurrentVersion,
  versionedAnimaPath,
} from "./install-prefix.ts";

describe("install-prefix", () => {
  it("defaultStandaloneInstallPrefix uses ~/.anima/standalone layout", () => {
    expect(defaultStandaloneInstallPrefix("/tmp/anima-home")).toBe(
      join("/tmp/anima-home", "standalone"),
    );
  });

  it("defaultAnimaBinDir uses ~/.local/bin under user home", () => {
    expect(defaultAnimaBinDir("/tmp/user")).toBe(join("/tmp/user", ".local", "bin"));
  });

  it("resolveInstallPrefixFromEnv prefers FREEANIMA_INSTALL_PREFIX", () => {
    expect(
      resolveInstallPrefixFromEnv(
        { FREEANIMA_INSTALL_PREFIX: "/opt/freeanima" },
        "/tmp/anima-home",
      ),
    ).toBe(require("node:path").resolve("/opt/freeanima"));
  });

  it("rejects prefix inside monorepo", () => {
    const root = createTempDir("freeanima-prefix-mono-");
    try {
      writeFileSync(join(root, "package.json"), JSON.stringify({ name: "freeanima" }));
      const staging = join(root, "dist", "anima-executable");
      mkdirSync(staging, { recursive: true });
      expect(isPathInsideMonorepo(staging, root)).toBe(true);
      expect(() => assertSafeStandaloneInstallPrefix(staging, { monorepoRoot: root })).toThrow(
        /monorepo/,
      );
    } finally {
      removeTempDir(root);
    }
  });

  it("allows independent prefix outside monorepo", () => {
    const root = createTempDir("freeanima-prefix-ok-");
    const mono = createTempDir("freeanima-prefix-mono2-");
    try {
      writeFileSync(join(mono, "package.json"), JSON.stringify({ name: "freeanima" }));
      expect(() => assertSafeStandaloneInstallPrefix(root, { monorepoRoot: mono })).not.toThrow();
    } finally {
      removeTempDir(root);
      removeTempDir(mono);
    }
  });
});

describe("standalone-versions", () => {
  it("normalizeVersionFileId strips leading v and unsafe chars", () => {
    expect(normalizeVersionFileId("v0.9.2")).toBe("0.9.2");
    expect(normalizeVersionFileId("0.9.1-canary+202607160949")).toBe("0.9.1-canary+202607160949");
    expect(normalizeVersionFileId("a/b c")).toBe("a_b_c");
  });

  it("installVersionedBinary writes anima_<ver>, current link, and prunes", () => {
    const root = createTempDir("freeanima-versions-");
    const prefix = join(root, "standalone");
    const stagingDir = join(root, "staging");
    const binDir = join(root, "local-bin");
    const animaHome = join(root, "anima-home");
    mkdirSync(stagingDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    mkdirSync(join(animaHome, "bin"), { recursive: true });
    try {
      for (let i = 1; i <= 8; i++) {
        const staged = join(stagingDir, `bin-${i}`);
        writeFileSync(staged, `#!/bin/sh\necho ${i}\n`);
        chmodSync(staged, 0o755);
        // ensure distinct mtimes
        installVersionedBinary(prefix, staged, `0.0.${i}`, {
          maxKeep: 7,
          binDir,
          animaHome,
        });
        Bun.sleepSync(5);
      }

      const installed = listInstalledVersions(prefix);
      expect(installed.length).toBe(7);
      expect(getCurrentVersionId(prefix)).toBe("0.0.8");
      expect(readlinkSync(join(prefix, "anima"))).toBe("anima_0.0.8");
      expect(installed.some((v) => v.id === "0.0.1")).toBe(false);
      expect(readlinkSync(join(binDir, "anima"))).toBe(join(prefix, "anima"));
    } finally {
      removeTempDir(root);
    }
  });

  it("migrateFlatAnimaFileIfNeeded renames flat anima then setCurrent works", () => {
    const root = createTempDir("freeanima-migrate-");
    const prefix = join(root, "standalone");
    const binDir = join(root, "local-bin");
    const animaHome = join(root, "anima-home");
    mkdirSync(prefix, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    try {
      const flat = join(prefix, "anima");
      writeFileSync(flat, "old-binary");
      chmodSync(flat, 0o755);
      expect(migrateFlatAnimaFileIfNeeded(prefix, "0.8.5")).toBe(true);
      expect(readlinkSync(flat)).toBe("anima_0.8.5");
      expect(getCurrentVersionId(prefix)).toBe("0.8.5");

      const staged = join(root, "new");
      writeFileSync(staged, "new-binary");
      chmodSync(staged, 0o755);
      installVersionedBinary(prefix, staged, "0.9.0", { binDir, animaHome });
      expect(getCurrentVersionId(prefix)).toBe("0.9.0");
      setCurrentVersion(prefix, "0.8.5", { binDir, animaHome });
      expect(getCurrentVersionId(prefix)).toBe("0.8.5");
    } finally {
      removeTempDir(root);
    }
  });

  it("pruneVersionedBinaries never deletes current", () => {
    const root = createTempDir("freeanima-prune-");
    const prefix = join(root, "standalone");
    const binDir = join(root, "local-bin");
    mkdirSync(prefix, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    try {
      for (const id of ["a", "b", "c"]) {
        const p = versionedAnimaPath(prefix, id);
        writeFileSync(p, id);
        chmodSync(p, 0o755);
        Bun.sleepSync(5);
      }
      setCurrentVersion(prefix, "a", { binDir, animaHome: join(root, "home") });
      const removed = pruneVersionedBinaries(prefix, 2);
      expect(getCurrentVersionId(prefix)).toBe("a");
      expect(listInstalledVersions(prefix).some((v) => v.id === "a")).toBe(true);
      expect(removed.length).toBeGreaterThanOrEqual(1);
      expect(removed.includes("a")).toBe(false);
    } finally {
      removeTempDir(root);
    }
  });
});
