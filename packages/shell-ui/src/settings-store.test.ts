import { describe, expect, test } from "bun:test";

import { createShellClientStore } from "./settings-store.ts";

describe("createShellClientStore", () => {
  test("透传 test() 当 API 提供时", async () => {
    let tested: unknown;
    const store = createShellClientStore({
      async load() {
        return { hubUrl: "http://127.0.0.1:2658", remoteAuthToken: "x".repeat(16) };
      },
      async save() {},
      async test(value) {
        tested = value;
      },
    });
    expect(store.test).toBeDefined();
    await store.test?.({ hubUrl: "http://a", remoteAuthToken: "y".repeat(16) });
    expect(tested).toEqual({ hubUrl: "http://a", remoteAuthToken: "y".repeat(16) });
  });

  test("无 test API 时不暴露 test", () => {
    const store = createShellClientStore({
      async load() {
        return null;
      },
      async save() {},
    });
    expect(store.test).toBeUndefined();
  });
});
