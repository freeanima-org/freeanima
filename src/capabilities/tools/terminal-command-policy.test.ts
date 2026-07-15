import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import { join } from "node:path";
import { assertTerminalCommandAllowed, splitCommandLine } from "./terminal-command-policy.ts";

describe("terminal-command-policy", () => {
  let cwd: string;
  let home: string;
  const prevHome = process.env.HOME;

  beforeEach(() => {
    home = createTempDir("anima-term-policy-home-");
    cwd = createTempDir("anima-term-policy-cwd-");
    process.env.HOME = home;
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    removeTempDir(home);
    removeTempDir(cwd);
  });

  it("splitCommandLine respects quotes", () => {
    expect(splitCommandLine(`echo "a b" 'c d'`)).toEqual(["echo", "a b", "c d"]);
  });

  it("blocks catastrophic rm targets", () => {
    expect(assertTerminalCommandAllowed("rm -rf /", { workdir: cwd })).toContain("catastrophic");
    expect(assertTerminalCommandAllowed("rm -fr /*", { workdir: cwd })).toContain("catastrophic");
    expect(assertTerminalCommandAllowed("rm -rf ~", { workdir: cwd })).toContain("catastrophic");
    expect(assertTerminalCommandAllowed("rm -rf ~/*", { workdir: cwd })).toContain("catastrophic");
    expect(assertTerminalCommandAllowed("rm -rf $HOME", { workdir: cwd })).toContain(
      "catastrophic",
    );
    expect(assertTerminalCommandAllowed("/bin/rm -rf /etc", { workdir: cwd })).toContain(
      "catastrophic",
    );
  });

  it("allows rm inside project cwd", () => {
    expect(
      assertTerminalCommandAllowed(`rm -rf ${join(cwd, "build")}`, { workdir: cwd }),
    ).toBeNull();
  });

  it("blocks mkfs, dd to /dev, power, fork bomb", () => {
    expect(assertTerminalCommandAllowed("mkfs.ext4 /dev/sda1", { workdir: cwd })).toContain(
      "filesystem",
    );
    expect(assertTerminalCommandAllowed("dd if=/dev/zero of=/dev/sda", { workdir: cwd })).toContain(
      "dd",
    );
    expect(assertTerminalCommandAllowed("reboot", { workdir: cwd })).toContain("power");
    expect(assertTerminalCommandAllowed(":(){ :|:& };:", { workdir: cwd })).toContain("fork bomb");
  });

  it("blocks recursive chmod on /", () => {
    expect(assertTerminalCommandAllowed("chmod -R 777 /", { workdir: cwd })).toContain(
      "catastrophic",
    );
  });

  it("blocks destructive find on /", () => {
    expect(assertTerminalCommandAllowed("find / -delete", { workdir: cwd })).toContain(
      "destructive find",
    );
  });
});
