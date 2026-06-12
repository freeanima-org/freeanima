import { describe, it, expect } from "bun:test";
import { Config } from "@freeanima/service-config";
import { parseYaml } from "@freeanima/service-config";
import { animaConfigSchema } from "@freeanima/service-config/schemas/config";
import { MINIMAL_LLM_YAML } from "@freeanima/service-config/test-helpers/minimal-llm-config";
import { getAcpManager, registerAcpTools } from "@freeanima/capabilities-acp";
import { createEngineCatalog } from "@freeanima/orchestration-runtime";

function emptyConfig() {
  const parsed = animaConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return Config.fromSnapshot(parsed.data);
}

describe("acp manager", () => {
  it("registerAcpTools returns 0 when no agents configured", () => {
    const config = emptyConfig();
    const catalog = createEngineCatalog();
    getAcpManager().wireRegistries({ toolSets: catalog.toolSets, skills: catalog.skills, config });
    const count = registerAcpTools({});
    expect(count).toBe(0);
  });

  it("registerAcpTools registers tools from config", () => {
    const config = emptyConfig();
    const catalog = createEngineCatalog();
    getAcpManager().wireRegistries({ toolSets: catalog.toolSets, skills: catalog.skills, config });
    const before = catalog.toolSets.listTools().filter((t) => t.name.startsWith("acp_")).length;
    const count = registerAcpTools({
      test_agent: {
        command: "echo",
        args: [],
        description: "test agent",
      },
    });
    expect(count).toBe(1);
    const names = catalog.toolSets.listTools().map((t) => t.name);
    expect(names).toContain("acp_test_agent");
    expect(names.length).toBeGreaterThanOrEqual(before + 1);
  });
});
