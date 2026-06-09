import { afterEach, describe, expect, it } from "bun:test";
import { pingDatabase } from "./health.ts";
import { initDatabase, resetDatabaseForTest, setDbForTest } from "./client.ts";

describe("pingDatabase", () => {
  afterEach(() => {
    resetDatabaseForTest();
  });

  it("未配置 database.url 时返回 not_configured", async () => {
    resetDatabaseForTest();
    expect(await pingDatabase()).toEqual({ status: "not_configured" });
  });

  it("SELECT 1 成功时返回 connected", async () => {
    initDatabase({ getDatabaseUrl: () => "postgresql://localhost/test" });
    setDbForTest({
      execute: async () => [{ "?column?": 1 }],
    } as never);
    const result = await pingDatabase();
    expect(result.status).toBe("connected");
    if (result.status === "connected") {
      expect(typeof result.latency_ms).toBe("number");
    }
  });

  it("查询失败时返回 error", async () => {
    initDatabase({ getDatabaseUrl: () => "postgresql://localhost/test" });
    setDbForTest({
      execute: async () => {
        throw new Error("connection refused");
      },
    } as never);
    expect(await pingDatabase()).toEqual({ status: "error", error: "connection refused" });
  });
});
