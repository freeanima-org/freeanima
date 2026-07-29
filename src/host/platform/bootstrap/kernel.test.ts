import { describe, expect, it } from "bun:test";
import { Config } from "@freeanima/host/platform/config";
import { createServiceKernel } from "./kernel.ts";

describe("service-bootstrap kernel", () => {
  it("createServiceKernel returns HookRegistry and logger", () => {
    const config = Config.fromSnapshot({
      llm: {
        default_profile: "chat",
        providers: {
          main: {
            backend: "openai_compatible",
            base_url: "https://api.openai.com/v1",
            api_key: "sk-test",
          },
        },
        profiles: {
          chat: { chain: [{ provider: "main", model: "gpt-4" }] },
        },
      },
    });
    const kernel = createServiceKernel(config);
    expect(kernel.hookRegistry).toBeDefined();
    expect(kernel.logger.info).toBeFunction();
  });
});
