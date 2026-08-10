import { describe, expect, test } from "bun:test";

import {
  binaryHttpMeta,
  dualTransportMeta,
  longOpMeta,
  publicHttpMeta,
  wsOnlyMeta,
  HABITAT_RPC_LONG_TIMEOUT_MS,
  HABITAT_RPC_READ_TIMEOUT_MS,
  HABITAT_RPC_WRITE_TIMEOUT_MS,
} from "./index.ts";

describe("habitat rpc timeout tiers", () => {
  test("dualTransportMeta 读 3s / 写 10s", () => {
    expect(dualTransportMeta(true).timeoutMs).toBe(HABITAT_RPC_READ_TIMEOUT_MS);
    expect(dualTransportMeta(false).timeoutMs).toBe(HABITAT_RPC_WRITE_TIMEOUT_MS);
  });

  test("longOpMeta 30s", () => {
    expect(longOpMeta(false).timeoutMs).toBe(HABITAT_RPC_LONG_TIMEOUT_MS);
    expect(longOpMeta(true).timeoutMs).toBe(HABITAT_RPC_LONG_TIMEOUT_MS);
  });

  test("dualTransportMeta 可覆盖 timeoutMs", () => {
    expect(dualTransportMeta(false, { timeoutMs: 60_000 }).timeoutMs).toBe(60_000);
  });

  test("public / ws / binary 默认档", () => {
    expect(publicHttpMeta().timeoutMs).toBe(HABITAT_RPC_READ_TIMEOUT_MS);
    expect(wsOnlyMeta().timeoutMs).toBe(HABITAT_RPC_WRITE_TIMEOUT_MS);
    expect(binaryHttpMeta({ verb: "POST", path: "x" }).timeoutMs).toBe(HABITAT_RPC_LONG_TIMEOUT_MS);
  });
});
