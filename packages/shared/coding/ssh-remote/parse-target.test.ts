import { describe, expect, it } from "bun:test";

import { isLoopbackHabitatUrl, mappedLoopbackHabitatUrl, parseSshRemoteTarget } from "./index.ts";

describe("parseSshRemoteTarget", () => {
  it("parses user@host and absolute workspace", () => {
    const t = parseSshRemoteTarget({
      ssh: "alice@dev.example",
      remoteWorkspace: "/home/alice/repo",
    });
    expect(t).toEqual({
      user: "alice",
      host: "dev.example",
      remoteWorkspace: "/home/alice/repo",
    });
  });

  it("parses port and identity", () => {
    const t = parseSshRemoteTarget({
      ssh: "bob@10.0.0.1:2222",
      remoteWorkspace: "/srv/app",
      identityFile: "~/.ssh/id_ed25519",
    });
    expect(t.user).toBe("bob");
    expect(t.host).toBe("10.0.0.1");
    expect(t.port).toBe(2222);
    expect(t.identityFile).toBe("~/.ssh/id_ed25519");
  });

  it("rejects relative remote workspace", () => {
    expect(() => parseSshRemoteTarget({ ssh: "u@h", remoteWorkspace: "rel/path" })).toThrow(
      /绝对路径/,
    );
  });
});

describe("loopback habitat tunnel helpers", () => {
  it("detects loopback hosts", () => {
    expect(isLoopbackHabitatUrl("http://127.0.0.1:2658")).toBe(true);
    expect(isLoopbackHabitatUrl("http://localhost:2658")).toBe(true);
    expect(isLoopbackHabitatUrl("https://habitat.example")).toBe(false);
  });

  it("maps reverse tunnel URL", () => {
    expect(mappedLoopbackHabitatUrl(2658, "http://127.0.0.1:2658")).toBe("http://127.0.0.1:2658");
  });
});
