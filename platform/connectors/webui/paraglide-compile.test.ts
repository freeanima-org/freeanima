import { describe, it, expect } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveBundledParaglideDir } from "./paraglide-compile.ts";

describe("resolveBundledParaglideDir", () => {
  it("returns messages/paraglide when runtime.js exists", () => {
    const root = mkdtempSync(join(tmpdir(), "freeanima-paraglide-root-"));
    const dir = join(root, "messages", "paraglide");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "runtime.js"), "export {};\n");
    expect(resolveBundledParaglideDir(root)).toBe(dir);
  });

  it("returns null when bundled paraglide is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "freeanima-paraglide-root-"));
    expect(resolveBundledParaglideDir(root)).toBeNull();
  });
});
