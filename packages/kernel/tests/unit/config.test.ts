import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("config", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    home = mkdtempSync(join(tmpdir(), "freeanima-test-"));
    process.env.FREEANIMA_HOME = home;
    const { clearConfigCache } = await import("@freeanima/core");
    clearConfigCache();
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("loads yaml and defaults model", async () => {
    writeFileSync(join(home, "config.yaml"), "model: test-model\n", "utf-8");
    const { loadConfig, clearConfigCache } = await import("@freeanima/core");
    clearConfigCache();
    const cfg = loadConfig();
    expect(cfg.model).toBe("test-model");
  });

  it("loads firecrawl from yaml only", async () => {
    writeFileSync(
      join(home, "config.yaml"),
      "firecrawl:\n  api_url: http://127.0.0.1:3002\n",
      "utf-8",
    );
    const { loadConfig, clearConfigCache } = await import("@freeanima/core");
    clearConfigCache();
    const cfg = loadConfig();
    expect(cfg.firecrawl?.api_url).toBe("http://127.0.0.1:3002");
  });
});
