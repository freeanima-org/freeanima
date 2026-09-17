import { describe, expect, test } from "bun:test";
import {
  isSavePromptMuted,
  muteSavePromptForHost,
  normalizeSavePromptHost,
  setSavePromptSettingsStorageForTest,
} from "./save-prompt-settings.ts";

describe("save prompt muted hosts", () => {
  test("normalizeSavePromptHost 去 www 并小写", () => {
    expect(normalizeSavePromptHost("WWW.Example.COM")).toBe("example.com");
    expect(normalizeSavePromptHost("login.example.com")).toBe("login.example.com");
  });

  test("mute 后 isSavePromptMuted 为 true", async () => {
    const store = new Map<string, unknown>();
    setSavePromptSettingsStorageForTest({
      async get(key: string) {
        const value = store.get(key);
        return value === undefined ? {} : { [key]: value };
      },
      async set(data: Record<string, unknown>) {
        for (const [key, value] of Object.entries(data)) store.set(key, value);
      },
    });

    expect(await isSavePromptMuted("www.demo.test")).toBe(false);
    await muteSavePromptForHost("WWW.Demo.Test");
    expect(await isSavePromptMuted("demo.test")).toBe(true);
    expect(await isSavePromptMuted("other.test")).toBe(false);

    setSavePromptSettingsStorageForTest(null);
  });
});
