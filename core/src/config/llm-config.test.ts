import { describe, it, expect } from "bun:test";
import { Config } from "@freeanima/core/config";
import { animaConfigSchema } from "@freeanima/core/config";
import { getProfileHopModel, resolveConfiguredProfileId } from "./llm-config.ts";

const CHAT_ONLY_SNAPSHOT = animaConfigSchema.parse({
  llm: {
    default_profile: "chat",
    providers: {
      main: {
        backend: "openai_compatible",
        base_url: "https://api.openai.com/v1",
        api_key: "test-key",
      },
    },
    profiles: {
      chat: {
        chain: [{ provider: "main", model: "chat-model" }],
      },
    },
  },
});

function chatOnlyConfig() {
  return Config.fromSnapshot(CHAT_ONLY_SNAPSHOT);
}

describe("resolveConfiguredProfileId", () => {
  it("returns preferred profile when configured", () => {
    const cfg = chatOnlyConfig().data;
    expect(resolveConfiguredProfileId(cfg, "chat")).toBe("chat");
  });

  it("falls back to default_profile when scene profile is missing", () => {
    const cfg = chatOnlyConfig().data;
    expect(resolveConfiguredProfileId(cfg, "summary")).toBe("chat");
    expect(resolveConfiguredProfileId(cfg, "reflect")).toBe("chat");
  });

  it("getProfileHopModel uses fallback model for missing scene profile", () => {
    const cfg = chatOnlyConfig().data;
    expect(getProfileHopModel(cfg, "summary")).toBe("chat-model");
  });
});
