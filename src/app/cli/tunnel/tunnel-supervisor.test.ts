import { describe, it, expect } from "bun:test";
import {
  findCloudflaredPidOnHost,
  getTunnelStatus,
  hubStackSystemdUnits,
} from "./tunnel-supervisor.ts";
import { SYSTEMD_UNIT } from "../systemd-unit.ts";

describe("hubStackSystemdUnits", () => {
  it("仅包含 anima.service stack unit", () => {
    const units = hubStackSystemdUnits();
    expect(units).toEqual([SYSTEMD_UNIT]);
  });
});

describe("getTunnelStatus", () => {
  it("running 与主机上 cloudflared 进程一致", () => {
    const pid = findCloudflaredPidOnHost();
    const status = getTunnelStatus();
    expect(status.running).toBe(pid != null);
  });
});
