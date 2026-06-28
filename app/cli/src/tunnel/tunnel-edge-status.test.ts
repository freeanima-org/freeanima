import { describe, expect, it } from "bun:test";
import {
  formatTunnelConnectedLabel,
  isTunnelEdgeConnected,
  parseMetricsPortFromSsLine,
  parseTunnelHaConnections,
  resolveMetricsPortForPid,
} from "./tunnel-edge-status.ts";

const SAMPLE_METRICS = `
# HELP cloudflared_tunnel_ha_connections Number of active ha connections
# TYPE cloudflared_tunnel_ha_connections gauge
cloudflared_tunnel_ha_connections 4
cloudflared_tunnel_request_errors 0
`;

describe("parseTunnelHaConnections", () => {
  it("解析 ha_connections 指标", () => {
    expect(parseTunnelHaConnections(SAMPLE_METRICS)).toBe(4);
  });

  it("无指标时返回 null", () => {
    expect(parseTunnelHaConnections("# empty\n")).toBeNull();
  });
});

describe("isTunnelEdgeConnected", () => {
  it("大于 0 视为已连接", () => {
    expect(isTunnelEdgeConnected(4)).toBe(true);
    expect(isTunnelEdgeConnected(1)).toBe(true);
  });

  it("0 或 null 视为未连接", () => {
    expect(isTunnelEdgeConnected(0)).toBe(false);
    expect(isTunnelEdgeConnected(null)).toBe(false);
  });
});

describe("resolveMetricsPortForPid", () => {
  const ssOutput = `LISTEN 0 4096 127.0.0.1:20242 0.0.0.0:* users:(("cloudflared",pid=161387,fd=8))
LISTEN 0 4096 127.0.0.1:20241 0.0.0.0:* users:(("cloudflared",pid=999,fd=8))`;

  it("匹配指定 PID 的 metrics 端口", () => {
    expect(parseMetricsPortFromSsLine(ssOutput.split("\n")[0]!, 161387)).toBe(20242);
    expect(resolveMetricsPortForPid(161387, ssOutput)).toBe(20242);
  });

  it("PID 不匹配时返回 null", () => {
    expect(resolveMetricsPortForPid(1, ssOutput)).toBeNull();
  });
});

describe("formatTunnelConnectedLabel", () => {
  it("已连接时显示连接数", () => {
    expect(formatTunnelConnectedLabel({ connected: true, haConnections: 4 })).toBe(
      "yes (4 edge connections)",
    );
  });

  it("未连接与未知时有提示", () => {
    expect(formatTunnelConnectedLabel({ connected: false, haConnections: 0 })).toContain("no —");
    expect(formatTunnelConnectedLabel({ connected: null, haConnections: null })).toContain(
      "unknown —",
    );
  });
});
