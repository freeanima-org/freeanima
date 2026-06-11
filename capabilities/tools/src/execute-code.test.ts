import { describe, it, expect } from "bun:test";
import { Config } from "@freeanima/service-config";
import { ToolSetRegistry } from "@freeanima/engine-tool";
import { parseYaml } from "@freeanima/service-config";
import { animaConfigSchema } from "@freeanima/service-config/schemas/config";
import { MINIMAL_LLM_YAML } from "@freeanima/service-config/test-helpers/minimal-llm-config";
import { parseRuntime, clampTimeout, runExecuteCode } from "./execute-code-runtimes.ts";
import { registerCoreTools } from "@freeanima/capabilities-tools";

function testConfig() {
  const parsed = animaConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return Config.fromSnapshot(parsed.data);
}

describe("execute_code runtimes", () => {
  it("parseRuntime defaults to bun", () => {
    expect(parseRuntime(undefined)).toBe("bun");
    expect(parseRuntime("bun")).toBe("bun");
    expect(parseRuntime("nodejs")).toBe("nodejs");
  });

  it("parseRuntime falls back for unknown values", () => {
    expect(parseRuntime("ruby")).toBe("bun");
  });

  it("clampTimeout respects bounds", () => {
    expect(clampTimeout(undefined)).toBe(300);
    expect(clampTimeout(9999)).toBe(600);
    expect(clampTimeout(0)).toBe(1);
  });

  it("runs bun code", async () => {
    const out = await runExecuteCode('console.log("anima-exec-ok");', "bun", 30);
    expect(out.trim()).toBe("anima-exec-ok");
  });

  it("runs nodejs code when node is available", async () => {
    const which = Bun.spawnSync(["which", "node"]);
    if (which.exitCode !== 0) return;
    const out = await runExecuteCode('console.log("anima-node-ok");', "nodejs", 30);
    expect(out.trim()).toBe("anima-node-ok");
  });
});

describe("openaiSchemas", () => {
  it("tools use flat parameters and top-level description", () => {
    const toolSets = new ToolSetRegistry();
    registerCoreTools(toolSets, testConfig());

    const schemas = toolSets.openaiSchemas();
    expect(schemas.length).toBeGreaterThan(0);

    for (const s of schemas) {
      expect(s.type).toBe("function");
      const fn = s.function as Record<string, unknown>;
      expect(typeof fn.name).toBe("string");
      expect((fn.name as string).length).toBeGreaterThan(0);
      expect(typeof fn.description).toBe("string");
      const params = fn.parameters as Record<string, unknown>;
      expect(params).toBeTypeOf("object");
      expect(params.type).toBe("object");
      expect(params).not.toHaveProperty("parameters");
    }

    const exec = schemas.find((s) => (s.function as { name: string }).name === "code_execute");
    expect(exec).toBeDefined();
    const desc = (exec!.function as { description: string }).description;
    expect(desc).toContain("bun");
    expect(desc).not.toBe("Run code");

    const params = (exec!.function as { parameters: { properties: Record<string, unknown> } })
      .parameters;
    expect(params.properties.runtime).toBeDefined();
    expect(params.properties.code).toBeDefined();
  });
});
