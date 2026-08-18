import { describe, expect, it } from "bun:test";
import { Config } from "@freeanima/habitat/platform/config";
import { createServiceKernel } from "./kernel.ts";

describe("service-bootstrap kernel", () => {
  it("createServiceKernel returns HookRegistry and logger", () => {
    const config = Config.fromSnapshot({
      connections: {
        main: {
          preset: "custom",
          custom_kind: "text",
          text_protocol: "openai_compatible",
          base_url: "https://api.openai.com/v1",
          api_key: "sk-test",
        },
      },
      text_generate: { main: { connection: "main", model: "gpt-4" } },
    });
    const kernel = createServiceKernel(config);
    expect(kernel.hookRegistry).toBeDefined();
    expect(typeof kernel.logger.info).toBe("function");
  });
});
