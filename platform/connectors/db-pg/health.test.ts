import { afterEach, describe, expect, it } from "bun:test";
import { pingDatabase } from "./health.ts";
import { initDatabase, resetDatabaseForTest, setDbForTest } from "./client.ts";

describe("pingDatabase", () => {
  afterEach(() => {
    resetDatabaseForTest();
  });

  it("Returns not_configured when database.url not configured", async () => {
    resetDatabaseForTest();
    expect(await pingDatabase()).toEqual({ status: "not_configured" });
  });

  it("Returns connected on successful SELECT 1", async () => {
    initDatabase({ getDatabaseUrl: () => "postgresql://localhost/test" });
    setDbForTest({
      select: () => ({
        from: async () => [{ n: 1 }],
      }),
    } as never);
    const result = await pingDatabase();
    expect(result.status).toBe("connected");
    if (result.status === "connected") {
      expect(typeof result.latency_ms).toBe("number");
    }
  });

  it("Returns error on query failure", async () => {
    initDatabase({ getDatabaseUrl: () => "postgresql://localhost/test" });
    setDbForTest({
      select: () => ({
        from: async () => {
          throw new Error("connection refused");
        },
      }),
    } as never);
    expect(await pingDatabase()).toEqual({ status: "error", error: "connection refused" });
  });
});
