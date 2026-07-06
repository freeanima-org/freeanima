import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createTempDir,
  isManagedAnimaTmpPath,
  removeManagedAnimaTmpPath,
  removeTempDir,
} from "./temp-dir.ts";

describe("temp-dir", () => {
  it("createTempDir and removeTempDir round-trip", () => {
    const dir = createTempDir("freeanima-temp-dir-test-");
    expect(existsSync(dir)).toBe(true);
    removeTempDir(dir);
    expect(existsSync(dir)).toBe(false);
  });

  it("isManagedAnimaTmpPath accepts runtime and test prefixes under tmpdir", () => {
    const base = tmpdir();
    expect(isManagedAnimaTmpPath(join(base, "anima-cwd-abc123"))).toBe(true);
    expect(isManagedAnimaTmpPath(join(base, "anima-exec-xyz"))).toBe(true);
    expect(isManagedAnimaTmpPath(join(base, "freeanima-eventbus-cfg-abc"))).toBe(true);
    expect(isManagedAnimaTmpPath(join(base, "companion-upload-abc"))).toBe(true);
    expect(isManagedAnimaTmpPath("/var/log/anima-cwd-abc")).toBe(false);
    expect(isManagedAnimaTmpPath(join(base, "unrelated-dir"))).toBe(false);
  });

  it("removeManagedAnimaTmpPath only removes managed paths", () => {
    const managed = createTempDir("anima-cwd-test-");
    const other = join(tmpdir(), "unrelated-freeanima-leak-test");
    mkdirSync(other, { recursive: true });
    try {
      expect(removeManagedAnimaTmpPath(managed)).toBe(true);
      expect(existsSync(managed)).toBe(false);
      expect(removeManagedAnimaTmpPath(other)).toBe(false);
      expect(existsSync(other)).toBe(true);
    } finally {
      removeTempDir(other);
    }
  });
});
