import { describe, it, expect } from "bun:test";
import { hubStackSystemdUnits } from "./tunnel-supervisor.ts";
import { SYSTEMD_UNIT } from "./systemd-unit.ts";
import { TUNNEL_SYSTEMD_UNIT } from "./tunnel-systemd-unit.ts";

describe("hubStackSystemdUnits", () => {
  it("至少包含 hub unit", () => {
    const units = hubStackSystemdUnits();
    expect(units).toContain(SYSTEMD_UNIT);
    expect(units[units.length - 1]).toBe(SYSTEMD_UNIT);
  });

  it("tunnel unit 存在时排在 hub 之前（便于并行 stop）", () => {
    const units = hubStackSystemdUnits();
    const tunnelIdx = units.indexOf(TUNNEL_SYSTEMD_UNIT);
    const hubIdx = units.indexOf(SYSTEMD_UNIT);
    if (tunnelIdx >= 0) {
      expect(tunnelIdx).toBeLessThan(hubIdx);
    }
  });
});
