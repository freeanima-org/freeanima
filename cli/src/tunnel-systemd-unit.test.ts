import { describe, expect, test } from "bun:test";
import { renderTunnelSystemdUnit } from "./tunnel-systemd-unit.ts";
import { cloudflaredRunExecStart } from "./tunnel-run.ts";

describe("tunnel-systemd-unit", () => {
  test("renderTunnelSystemdUnit embeds ExecStart", () => {
    const execStart = cloudflaredRunExecStart("/home/.anima/bin/cloudflared", {
      credentialsFile: "/home/.anima/cloudflared/credentials.json",
      configFile: "/home/.anima/cloudflared/config.yml",
      tunnelId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
    const unit = renderTunnelSystemdUnit(execStart);
    expect(unit).toContain("ExecStart=");
    expect(unit).toContain("anima.service");
    expect(execStart).toContain("cloudflared");
  });
});
