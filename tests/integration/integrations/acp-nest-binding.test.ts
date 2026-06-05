import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { clearConfigCache } from "@freeanima/service-config";
import { initSession } from "@freeanima/engine";
import {
  bindAcpSession,
  getBoundAcpSession,
  readAcpSessions,
  unbindAcpSession,
} from "@freeanima/legacy-integrations";

describePg("acp nest-binding", () => {
  let nestSid: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    clearConfigCache();
    await beginIntegrationCase("freeanima-acp-bind-");
    nestSid = "20260527_test_bind";
    await initSession(nestSid, "test-model", { platform: "parlor" });
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("bind / read / unbind acp_sessions on session_meta", async () => {
    expect(await readAcpSessions(nestSid)).toEqual({});
    await bindAcpSession(nestSid, "cursor", "acp-uuid-1");
    expect(await getBoundAcpSession(nestSid, "cursor")).toBe("acp-uuid-1");
    expect(await readAcpSessions(nestSid)).toEqual({ cursor: "acp-uuid-1" });
    await unbindAcpSession(nestSid, "cursor");
    expect(await getBoundAcpSession(nestSid, "cursor")).toBeUndefined();
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
