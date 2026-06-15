import { describe, it, expect } from "bun:test";
import { loadManagedSatellites } from "./satellite-supervisor.ts";

describe("loadManagedSatellites", () => {
  it("ignores entries without command", () => {
    const entries = loadManagedSatellites();
    for (const { config } of entries) {
      expect(config.command?.trim()).toBeTruthy();
    }
  });
});
