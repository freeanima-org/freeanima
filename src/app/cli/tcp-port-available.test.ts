import { describe, it, expect } from "bun:test";
import { createServer } from "node:net";
import { isTcpPortInUse } from "./tcp-port-available.ts";

describe("isTcpPortInUse", () => {
  it("returns false when port is free", async () => {
    expect(await isTcpPortInUse("127.0.0.1", 0)).toBe(false);
  });

  it("returns true when port is occupied", async () => {
    const held = createServer();
    await new Promise<void>((resolve, reject) => {
      held.once("error", reject);
      held.listen(0, "127.0.0.1", () => {
        resolve();
      });
    });
    const addr = held.address();
    if (addr === null || typeof addr === "string") {
      held.close();
      throw new Error("expected TCP address");
    }
    try {
      expect(await isTcpPortInUse("127.0.0.1", addr.port)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => {
        held.close(() => {
          resolve();
        });
      });
    }
  });
});
