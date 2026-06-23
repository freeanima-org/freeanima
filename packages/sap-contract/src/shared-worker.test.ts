import { describe, expect, it } from "bun:test";
import type { SapSharedWorkerInitConfig } from "./shared-worker.ts";

describe("SapSharedWorkerInitConfig", () => {
  it("structuredClone 可序列化（无函数/AbortSignal）", () => {
    const config: SapSharedWorkerInitConfig = {
      hubUrl: "http://127.0.0.1:2658",
      instanceStoreKey: "freeanima.sap.instance.http://127.0.0.1:2658|chat",
      connect: {
        app_id: "chat",
        features_requested: ["server_info"],
        http_url: "http://127.0.0.1:4174",
      },
    };
    expect(() => structuredClone(config)).not.toThrow();
  });
});
