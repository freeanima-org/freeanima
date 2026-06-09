import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { clearConfigCache } from "@freeanima/service-config";
import { testConv } from "../../helpers/pg-test.ts";
import {
  bindAcpSession,
  getBoundAcpSession,
  readAcpSessions,
  unbindAcpSession,
} from "@freeanima/capabilities-acp";

describePg("acp anima-binding", () => {
  let animaSid: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    clearConfigCache();
    await beginIntegrationCase("freeanima-acp-bind-");
    animaSid = "20260527_test_bind";
    await testConv().initSession(animaSid, "test-model", { platform: "parlor" });
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("bind / read / unbind acp_sessions on session_meta", async () => {
    const c = testConv();
    expect(await readAcpSessions(c, animaSid)).toEqual({});
    await bindAcpSession(c, animaSid, "cursor", "acp-uuid-1");
    expect(await getBoundAcpSession(c, animaSid, "cursor")).toBe("acp-uuid-1");
    expect(await readAcpSessions(c, animaSid)).toEqual({ cursor: "acp-uuid-1" });
    await unbindAcpSession(c, animaSid, "cursor");
    expect(await getBoundAcpSession(c, animaSid, "cursor")).toBeUndefined();
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
