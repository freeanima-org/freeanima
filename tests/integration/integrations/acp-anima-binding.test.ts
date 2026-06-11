import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { testConv } from "../../helpers/pg-test.ts";
import {
  bindAcpTaskRunning,
  getBoundAcpSession,
  readAcpTasks,
  unbindAcpSession,
} from "@freeanima/capabilities-acp";

describePg("acp acp_tasks binding", () => {
  let animaSid: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-acp-bind-");
    animaSid = "20260527_test_bind";
    await testConv().initSession(animaSid, "test-model", { platform: "parlor" });
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("bind / read / unbind acp_tasks on session_meta", async () => {
    const c = testConv();
    expect(await readAcpTasks(c, animaSid)).toEqual({});
    await bindAcpTaskRunning(c, animaSid, "cursor", "acp-uuid-1", "task-1");
    expect(await getBoundAcpSession(c, animaSid, "cursor")).toBe("acp-uuid-1");
    expect(await readAcpTasks(c, animaSid)).toEqual({
      "acp-uuid-1": {
        status: "running",
        task_id: "task-1",
        agent_name: "cursor",
        updated_at: expect.any(String),
      },
    });
    await unbindAcpSession(c, animaSid, "cursor");
    expect(await getBoundAcpSession(c, animaSid, "cursor")).toBeUndefined();
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
