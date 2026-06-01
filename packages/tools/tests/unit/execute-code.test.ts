import { describe, it, expect } from "vitest";

describe("execute_code runtimes", () => {
  it("parseRuntime defaults to nodejs", async () => {
    const { parseRuntime } = await import("../../src/execute-code-runtimes.ts");
    expect(parseRuntime(undefined)).toBe("nodejs");
    expect(parseRuntime("nodejs")).toBe("nodejs");
  });

  it("parseRuntime falls back for unknown values", async () => {
    const { parseRuntime } = await import("../../src/execute-code-runtimes.ts");
    expect(parseRuntime("ruby")).toBe("nodejs");
  });

  it("clampTimeout respects bounds", async () => {
    const { clampTimeout } = await import("../../src/execute-code-runtimes.ts");
    expect(clampTimeout(undefined)).toBe(300);
    expect(clampTimeout(9999)).toBe(600);
    expect(clampTimeout(0)).toBe(1);
  });

  it("runs nodejs code", async () => {
    const { runExecuteCode } = await import("../../src/execute-code-runtimes.ts");
    const out = runExecuteCode('console.log("anima-exec-ok");', "nodejs", 30);
    expect(out.trim()).toBe("anima-exec-ok");
  });

  it("returns error JSON for disabled python runtime", async () => {
    const { runExecuteCode } = await import("../../src/execute-code-runtimes.ts");
    const out = runExecuteCode('print("hi")', "python", 30);
    const parsed = JSON.parse(out) as { error: string };
    expect(parsed.error).toContain("python");
    expect(parsed.error).toContain("nodejs");
  });

  it("returns error JSON for disabled deno runtime", async () => {
    const { runExecuteCode } = await import("../../src/execute-code-runtimes.ts");
    const out = runExecuteCode('console.log("hi")', "deno", 30);
    expect(JSON.parse(out)).toMatchObject({ error: expect.stringContaining("deno") });
  });
});

describe("openaiSchemas", () => {
  it("tools use flat parameters and top-level description", async () => {
    const { registerAllTools } = await import("@freeanima/tools");
    const { openaiSchemas } = await import("@freeanima/core");
    registerAllTools();

    const schemas = openaiSchemas();
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

    const exec = schemas.find((s) => (s.function as { name: string }).name === "execute_code");
    expect(exec).toBeDefined();
    const desc = (exec!.function as { description: string }).description;
    expect(desc).toContain("nodejs");
    expect(desc).not.toBe("Run code");

    const params = (exec!.function as { parameters: { properties: Record<string, unknown> } }).parameters;
    expect(params.properties.runtime).toBeDefined();
    expect(params.properties.code).toBeDefined();
  });
});
