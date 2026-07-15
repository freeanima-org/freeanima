import { describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createTempDir, removeTempDir } from "@freeanima/core/util";
import {
  assertSafeStandaloneInstallPrefix,
  defaultStandaloneInstallPrefix,
  isPathInsideMonorepo,
  resolveInstallPrefixFromEnv,
} from "./install-prefix.ts";

describe("install-prefix", () => {
  it("defaultStandaloneInstallPrefix uses ~/.anima/standalone layout", () => {
    expect(defaultStandaloneInstallPrefix("/tmp/anima-home")).toBe(
      join("/tmp/anima-home", "standalone"),
    );
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
