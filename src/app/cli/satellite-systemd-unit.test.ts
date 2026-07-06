import { describe, it, expect } from "bun:test";
import { renderSatelliteSystemdUnit } from "./satellite-systemd-unit.ts";
import type { SatelliteLaunch } from "./satellite-launch.ts";

describe("satellite systemd unit", () => {
  const launch: SatelliteLaunch = {
    command: "bun",
    args: ["src/satellites/companion/dev.ts"],
    workingDirectory: "/opt/freeanima",
    environment: {
      FREEANIMA_URL: "http://127.0.0.1:2658",
      FREEANIMA_REPO_ROOT: "/opt/freeanima",
    },
    execStart: "bun src/satellites/companion/dev.ts",
  };

  it("includes PartOf anima.service and ExecStart", () => {
    const unit = renderSatelliteSystemdUnit("companion", launch);
    expect(unit).toContain("PartOf=anima.service");
    expect(unit).toContain("After=network.target anima.service");
    expect(unit).toContain("WorkingDirectory=/opt/freeanima");
    expect(unit).toContain("ExecStart=bun src/satellites/companion/dev.ts");
    expect(unit).toContain("Restart=always");
  });
});
