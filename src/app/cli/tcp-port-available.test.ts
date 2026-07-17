import { describe, it, expect } from "bun:test";
import { createServer } from "node:net";
import {
  findAvailableTcpPort,
  isTcpPortInUse,
  pickRandomAvailableTcpPort,
  DEV_HUB_PORT_MIN,
} from "./tcp-port-available.ts";

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

describe("findAvailableTcpPort", () => {
  it("skips occupied start port", async () => {
    const held = createServer();
    await new Promise<void>((resolve, reject) => {
      held.once("error", reject);
      held.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = held.address();
    if (addr === null || typeof addr === "string") {
      held.close();
      throw new Error("expected TCP address");
    }
    try {
      const port = await findAvailableTcpPort("127.0.0.1", addr.port, 5);
      expect(port).toBeGreaterThan(addr.port);
      expect(await isTcpPortInUse("127.0.0.1", port)).toBe(false);
    } finally {
      await new Promise<void>((resolve) => {
        held.close(() => resolve());
      });
    }
  });
});

describe("pickRandomAvailableTcpPort", () => {
  it("returns a free port in range", async () => {
    const port = await pickRandomAvailableTcpPort(
      "127.0.0.1",
      DEV_HUB_PORT_MIN,
      DEV_HUB_PORT_MIN + 200,
    );
    expect(port).toBeGreaterThanOrEqual(DEV_HUB_PORT_MIN);
    expect(port).toBeLessThanOrEqual(DEV_HUB_PORT_MIN + 200);
    expect(await isTcpPortInUse("127.0.0.1", port)).toBe(false);
  });
});
