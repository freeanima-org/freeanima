import { describe, expect, it, afterEach } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homePath } from "@freeanima/host/core/config/paths";
import {
  formatOversizedToolOutput,
  TOOL_OUTPUT_PREVIEW_MAX,
  toolArtifactsDir,
} from "./large-output.ts";

describe("formatOversizedToolOutput", () => {
  afterEach(() => {
    const dir = homePath("tool-artifacts");
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns small output unchanged", () => {
    expect(formatOversizedToolOutput("hello", { kind: "test" })).toBe("hello");
  });

  it("spills oversized output with artifact_path and file_read hint", () => {
    const full = "x".repeat(TOOL_OUTPUT_PREVIEW_MAX + 100);
    const out = formatOversizedToolOutput(full, { kind: "code-execute" });
    expect(out.startsWith("x".repeat(TOOL_OUTPUT_PREVIEW_MAX))).toBe(true);
    expect(out).toContain("truncated: true");
    expect(out).toContain("artifact_path:");
    expect(out).toContain("file_read");
    expect(out).toContain("Do not re-run the command");
    const match = /artifact_path: (.+)\n/.exec(out);
    expect(match?.[1]).toBeTruthy();
    const path = match![1]!.trim();
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf-8").length).toBe(full.length);
    expect(path.startsWith(toolArtifactsDir())).toBe(true);
  });

  it("creates tool-artifacts under FREEANIMA_HOME", () => {
    const dir = toolArtifactsDir();
    expect(dir).toBe(join(homePath("tool-artifacts")));
    expect(existsSync(dir)).toBe(true);
  });
});
