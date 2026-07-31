import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/host/core/util/temp-dir";
import {
  assertPathAllowed,
  isCatastrophicRmTarget,
  normalizeLexicalPath,
  resolveToolPath,
} from "./path-policy.ts";

describe("path-policy", () => {
  let home: string;
  let cwd: string;
  const prevHome = process.env.FREEANIMA_HOME;
  const prevUserHome = process.env.HOME;

  beforeEach(() => {
    home = createTempDir("anima-path-policy-home-");
    cwd = createTempDir("anima-path-policy-cwd-");
    process.env.FREEANIMA_HOME = join(home, ".anima");
    process.env.HOME = home;
    mkdirSync(join(home, ".anima", "vault"), { recursive: true });
    mkdirSync(join(home, ".ssh"), { recursive: true });
    writeFileSync(join(home, ".ssh", "id_ed25519"), "secret", "utf-8");
    writeFileSync(join(home, ".ssh", "id_ed25519.pub"), "pub", "utf-8");
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
    if (prevUserHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevUserHome;
    removeTempDir(home);
    removeTempDir(cwd);
  });

  it("resolveToolPath expands ~ and relative paths", () => {
    expect(resolveToolPath("~/x", cwd)).toBe(join(home, "x"));
    expect(resolveToolPath("rel.txt", cwd)).toBe(join(cwd, "rel.txt"));
    expect(resolveToolPath("/tmp/a", cwd)).toBe(resolve("/tmp/a"));
  });

  it("normalizeLexicalPath collapses parent segments", () => {
    expect(normalizeLexicalPath("/a/b/../c")).toBe("/a/c");
    expect(normalizeLexicalPath("/")).toBe("/");
  });

  it("denies /etc reads and writes", () => {
    expect(assertPathAllowed("/etc/passwd", "read", cwd)).toBe("blocked /etc path");
    expect(assertPathAllowed("/etc/hosts", "write", cwd)).toBe("blocked /etc path");
    expect(assertPathAllowed("/etc/new-dir/file", "write", cwd)).toBe("blocked /etc path");
  });

  it("denies vault and ssh private keys", () => {
    expect(assertPathAllowed(join(home, ".anima", "vault", "agent-machine.key"), "read", cwd)).toBe(
      "blocked vault path",
    );
    expect(assertPathAllowed(join(home, ".ssh", "id_ed25519"), "read", cwd)).toBe(
      "blocked ssh private path",
    );
    expect(assertPathAllowed(join(home, ".ssh", "id_ed25519.pub"), "read", cwd)).toBeNull();
  });

  it("allows normal project paths", () => {
    const p = join(cwd, "ok.txt");
    writeFileSync(p, "x", "utf-8");
    expect(assertPathAllowed(p, "read", cwd)).toBeNull();
    expect(assertPathAllowed(p, "write", cwd)).toBeNull();
  });

  it("isCatastrophicRmTarget covers /, ~, $HOME, system roots", () => {
    expect(isCatastrophicRmTarget("/", cwd)).toBe(true);
    expect(isCatastrophicRmTarget("/*", cwd)).toBe(true);
    expect(isCatastrophicRmTarget("~", cwd)).toBe(true);
    expect(isCatastrophicRmTarget("~/*", cwd)).toBe(true);
    expect(isCatastrophicRmTarget("$HOME", cwd)).toBe(true);
    expect(isCatastrophicRmTarget("/etc", cwd)).toBe(true);
    expect(isCatastrophicRmTarget("/etc/passwd", cwd)).toBe(true);
    expect(isCatastrophicRmTarget(join(cwd, "src"), cwd)).toBe(false);
  });
});
