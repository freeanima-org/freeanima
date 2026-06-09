import { describe, it, expect, beforeEach } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleClientMethod } from "./client-methods.ts";
import { diagnoseStderr } from "./stderr-patterns.ts";

describe("handleClientMethod", () => {
  let projectCwd: string;

  beforeEach(() => {
    projectCwd = mkdtempSync(join(tmpdir(), "acp-client-methods-"));
    mkdirSync(join(projectCwd, "src"), { recursive: true });
    writeFileSync(join(projectCwd, "src", "main.ts"), "export const hello = 1;\n");
    writeFileSync(
      join(projectCwd, "package.json"),
      JSON.stringify({ name: "test-proj", version: "1.0.0", scripts: { test: "echo ok" } }),
    );
  });

  it("fs/read_text_file 读取文件", () => {
    const r = handleClientMethod(
      "fs/read_text_file",
      { path: join(projectCwd, "src", "main.ts") },
      { projectCwd },
    );
    expect(r?.content).toContain("hello");
  });

  it("get_project_info 返回元数据", () => {
    const r = handleClientMethod("get_project_info", {}, { projectCwd });
    expect(r?.name).toBe("test-proj");
    expect(r?.cwd).toBe(projectCwd);
  });

  it("explain_code 返回代码内容", () => {
    const r = handleClientMethod(
      "explain_code",
      { path: join(projectCwd, "src", "main.ts") },
      { projectCwd },
    );
    expect(r?.content).toContain("hello");
  });

  it("未知方法返回 null", () => {
    expect(handleClientMethod("unknown/method", {}, { projectCwd })).toBeNull();
  });
});

describe("diagnoseStderr", () => {
  it("识别认证错误", () => {
    const d = diagnoseStderr(["Error: unauthorized access"]);
    expect(d?.pattern).toBe("authentication");
  });

  it("无匹配时返回 null", () => {
    expect(diagnoseStderr(["some random log"])).toBeNull();
  });
});
