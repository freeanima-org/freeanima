import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { describePg } from "../../../db/tests/helpers/pg-test-gate.ts";
import { beginIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";
import { endIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";

import { clearConfigCache } from "@freeanima/legacy-kernel";
import { initSession } from "@freeanima/legacy-engine";
import {
  bindAcpSession,
  getBoundAcpSession,
  readAcpSessions,
  unbindAcpSession,
} from "../../src/acp/nest-binding.js";

describePg("acp nest-binding", () => {
  let nestSid: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    clearConfigCache();
    const ctx = await beginIntegrationCase("freeanima-acp-bind-");
    nestSid = "20260527_test_bind";
    await initSession(nestSid, "test-model", { platform: "parlor" });
  });

  afterEach(async () => {
    clearConfigCache();
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
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