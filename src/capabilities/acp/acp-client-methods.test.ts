import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util/temp-dir";
import { handleClientMethod } from "./client-methods.ts";
import { diagnoseStderr } from "./stderr-patterns.ts";

describe("handleClientMethod", () => {
  let projectCwd: string;

  beforeEach(() => {
    projectCwd = createTempDir("acp-client-methods-");
    mkdirSync(join(projectCwd, "src"), { recursive: true });
    writeFileSync(join(projectCwd, "src", "main.ts"), "export const hello = 1;\n");
    writeFileSync(
      join(projectCwd, "package.json"),
      JSON.stringify({ name: "test-proj", version: "1.0.0", scripts: { test: "echo ok" } }),
    );
  });

  afterEach(() => {
    removeTempDir(projectCwd);
  });

  it("fs/read_text_file reads a file", () => {
    const r = handleClientMethod(
      "fs/read_text_file",
      { path: join(projectCwd, "src", "main.ts") },
      { projectCwd },
    );
    expect(r?.content).toContain("hello");
  });

  it("get_project_info returns metadata", () => {
    const r = handleClientMethod("get_project_info", {}, { projectCwd });
    expect(r?.name).toBe("test-proj");
    expect(r?.cwd).toBe(projectCwd);
  });

  it("explain_code returns code content", () => {
    const r = handleClientMethod(
      "explain_code",
      { path: join(projectCwd, "src", "main.ts") },
      { projectCwd },
    );
    expect(r?.content).toContain("hello");
  });

  it("unknown method returns null", () => {
    expect(handleClientMethod("unknown/method", {}, { projectCwd })).toBeNull();
  });
});

describe("diagnoseStderr", () => {
  it("recognizes authentication errors", () => {
    const d = diagnoseStderr(["Error: unauthorized access"]);
    expect(d?.pattern).toBe("authentication");
  });

  it("returns null when no match", () => {
    expect(diagnoseStderr(["some random log"])).toBeNull();
  });
});
