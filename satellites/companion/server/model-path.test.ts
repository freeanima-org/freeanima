import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isModelPathAvailable, PLACEHOLDER_MODEL_PATH, resolveModelFile } from "./model-path.ts";
import { companionModelsDir } from "./paths.ts";

describe("model-path", () => {
  test("占位路径在文件不存在时不可用", () => {
    expect(isModelPathAvailable(PLACEHOLDER_MODEL_PATH)).toBe(false);
  });

  test("可解析用户 models 目录下的文件", () => {
    const home = mkdtempSync(join(tmpdir(), "companion-model-path-"));
    const prev = process.env.FREEANIMA_HOME;
    process.env.FREEANIMA_HOME = home;
    try {
      const modelsDir = companionModelsDir();
      mkdirSync(modelsDir, { recursive: true });
      const filePath = join(modelsDir, "my-pet.vrm");
      writeFileSync(filePath, "vrm");

      const rel = "/models/my-pet.vrm";
      expect(resolveModelFile(rel)).toBe(filePath);
      expect(isModelPathAvailable(rel)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.FREEANIMA_HOME;
      else process.env.FREEANIMA_HOME = prev;
    }
  });

  test("拒绝路径穿越", () => {
    expect(resolveModelFile("/models/../secret.vrm")).toBeNull();
    expect(isModelPathAvailable("/models/foo/bar.vrm")).toBe(false);
  });
});
