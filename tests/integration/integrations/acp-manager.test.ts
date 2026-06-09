import { describe, it, expect, afterEach } from "bun:test";
import { parseYaml } from "@freeanima/service-config";
import { animaConfigSchema } from "@freeanima/service-config/schemas/config";
import { resetConfigForTest, setConfigForTest } from "@freeanima/service-config";
import { MINIMAL_LLM_YAML } from "@freeanima/service-config/test-helpers/minimal-llm-config";
import { getAcpManager, registerAcpTools } from "@freeanima/capabilities-acp";
import { createEngineCatalog } from "@freeanima/engine";

function emptyConfig() {
  const parsed = animaConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

describe("acp manager", () => {
  afterEach(() => {
    resetConfigForTest();
  });

  it("registerAcpTools returns 0 when no agents configured", () => {
    setConfigForTest(emptyConfig());
    const catalog = createEngineCatalog();
    getAcpManager().wireRegistries({ tools: catalog.tools, skills: catalog.skills });
    const count = registerAcpTools({});
    expect(count).toBe(0);
  });

  it("registerAcpTools registers tools from config", () => {
    setConfigForTest(emptyConfig());
    const catalog = createEngineCatalog();
    getAcpManager().wireRegistries({ tools: catalog.tools, skills: catalog.skills });
    const before = catalog.tools.list().filter((t) => t.name.startsWith("acp_")).length;
    const count = registerAcpTools({
      test_agent: {
        command: "echo",
        args: [],
        description: "测试 agent",
      },
    });
    expect(count).toBe(1);
    const names = catalog.tools.list().map((t) => t.name);
    expect(names).toContain("acp_test_agent");
    expect(names.length).toBeGreaterThanOrEqual(before + 1);
  });
});
