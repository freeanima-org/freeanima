import { afterEach, describe, expect, it } from "bun:test";
import { join } from "node:path";

import { getHomeDir, homePath, PATHS } from "./paths.ts";

describe("paths", () => {
  const prev = process.env.FREEANIMA_HOME;

  afterEach(() => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("getHomeDir honors FREEANIMA_HOME", () => {
    process.env.FREEANIMA_HOME = "/tmp/anima-test-home";
    expect(getHomeDir()).toBe("/tmp/anima-test-home");
    expect(homePath("config.yaml")).toBe(join("/tmp/anima-test-home", "config.yaml"));
  });

  it("PATHS getters resolve under home", () => {
    process.env.FREEANIMA_HOME = "/tmp/anima-paths";
    expect(PATHS.home).toBe("/tmp/anima-paths");
    expect(PATHS.configYaml).toBe(join("/tmp/anima-paths", "config.yaml"));
    expect(PATHS.cronDir).toBe(join("/tmp/anima-paths", "cron"));
    expect(PATHS.binDir).toBe(join("/tmp/anima-paths", "bin"));
  });
});
