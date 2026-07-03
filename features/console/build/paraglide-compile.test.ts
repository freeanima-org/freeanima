import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import { resolveBundledParaglideDir } from "./paraglide-compile.ts";

describe("resolveBundledParaglideDir", () => {
  it("returns messages/paraglide when runtime.js exists", () => {
    const root = createTempDir("freeanima-paraglide-root-");
    try {
      const dir = join(root, "messages", "paraglide");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "runtime.js"), "export {};\n");
      expect(resolveBundledParaglideDir(root)).toBe(dir);
    } finally {
      removeTempDir(root);
    }
  });

  it("returns null when bundled paraglide is missing", () => {
    const root = createTempDir("freeanima-paraglide-root-");
    try {
      expect(resolveBundledParaglideDir(root)).toBeNull();
    } finally {
      removeTempDir(root);
    }
  });
});
