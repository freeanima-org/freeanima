import { describe, it, expect } from "bun:test";
import { hubStackSystemdUnits } from "./tunnel-supervisor.ts";
import { SYSTEMD_UNIT } from "../systemd-unit.ts";

describe("hubStackSystemdUnits", () => {
  it("仅包含 anima.service stack unit", () => {
    const units = hubStackSystemdUnits();
    expect(units).toEqual([SYSTEMD_UNIT]);
  });
});
