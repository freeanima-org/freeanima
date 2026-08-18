import { afterEach, beforeEach } from "bun:test";
import {
  bindActiveRuntimeConfig,
  Config,
  resetActiveConfigForTest,
} from "@freeanima/habitat/core/config";

const MINIMAL_COMPRESSION_CONFIG = {
  connections: {
    main: {
      preset: "custom" as const,
      custom_kind: "text" as const,
      text_protocol: "openai_compatible" as const,
      base_url: "https://api.openai.com/v1",
      api_key: "test",
    },
  },
  text_generate: { main: { connection: "main", model: "gpt-4" } },
};

/** Bind minimal active Config for compressor unit tests (compress() reads compression defaults). */
export function installCompressionConfigForTests(): void {
  beforeEach(() => {
    bindActiveRuntimeConfig(Config.fromSnapshot(MINIMAL_COMPRESSION_CONFIG));
  });
  afterEach(() => {
    resetActiveConfigForTest();
  });
}
