import { afterEach, beforeEach } from "bun:test";
import { bindActiveConfig, Config, resetActiveConfigForTest } from "@freeanima/core/config";

const MINIMAL_COMPRESSION_CONFIG = {
  llm: {
    default_profile: "chat",
    providers: {
      main: {
        backend: "openai_compatible" as const,
        base_url: "https://api.openai.com/v1",
        api_key: "test",
      },
    },
    profiles: { chat: { chain: [{ provider: "main", model: "gpt-4" }] } },
  },
};

/** Bind minimal active Config for compressor unit tests (compress() reads compression defaults). */
export function installCompressionConfigForTests(): void {
  beforeEach(() => {
    bindActiveConfig(Config.fromSnapshot(MINIMAL_COMPRESSION_CONFIG));
  });
  afterEach(() => {
    resetActiveConfigForTest();
  });
}
