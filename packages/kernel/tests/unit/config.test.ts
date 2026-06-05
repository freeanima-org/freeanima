import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { clearConfigCache, getProfileHopModel, loadConfig } from "@freeanima/legacy-kernel";
import { MINIMAL_LLM_YAML } from "../helpers/llm-config-fixture.ts";

describe("config", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "freeanima-test-"));
    process.env.FREEANIMA_HOME = home;
    clearConfigCache();
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("loads llm profiles and resolves default model", () => {
    writeFileSync(join(home, "config.yaml"), MINIMAL_LLM_YAML, "utf-8");
    clearConfigCache();
    const cfg = loadConfig();
    expect(getProfileHopModel(cfg, "chat")).toBe("test-model");
    expect(cfg.llm.default_profile).toBe("chat");
  });

  it("loads firecrawl with llm block", () => {
    writeFileSync(
      join(home, "config.yaml"),
      `${MINIMAL_LLM_YAML}\nfirecrawl:\n  api_url: http://127.0.0.1:3002\n`,
      "utf-8",
    );
    clearConfigCache();
    const cfg = loadConfig();
    expect(cfg.firecrawl?.api_url).toBe("http://127.0.0.1:3002");
  });
});
