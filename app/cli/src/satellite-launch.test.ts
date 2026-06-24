import { describe, it, expect } from "bun:test";
import { getInstallContext, resolveSatelliteLaunch, formatExecStart } from "./satellite-launch.ts";

describe("satellite-launch", () => {
  it("formatExecStart quotes args with spaces", () => {
    expect(formatExecStart("/usr/bin/bun", ["/path/with spaces/dev.ts"])).toBe(
      '/usr/bin/bun "/path/with spaces/dev.ts"',
    );
  });

  it("resolveSatelliteLaunch uses monorepoRoot when available", () => {
    const ctx = getInstallContext();
    const launch = resolveSatelliteLaunch(
      { command: "bun", args: ["satellites/pair-programming/dev.ts"] },
      { hubUrl: "http://127.0.0.1:2658", install: ctx },
    );
    expect(launch.workingDirectory).toBe(ctx.monorepoRoot ?? ctx.cliRoot);
    expect(launch.environment.FREEANIMA_URL).toBe("http://127.0.0.1:2658");
    expect(launch.environment.FREEANIMA_REPO_ROOT).toBe(launch.workingDirectory);
    expect(launch.execStart).toContain("bun");
  });

  it("resolveSatelliteLaunch rejects missing command", () => {
    expect(() => resolveSatelliteLaunch({ args: [] })).toThrow(/command/);
  });
});
