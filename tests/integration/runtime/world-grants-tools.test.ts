import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { runWithToolContext } from "@freeanima/habitat/kernel/loop-mechanism";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { getProfileHopModel } from "@freeanima/habitat/platform/config";
import { registerContentBlockTools } from "@freeanima/features/content-block/domain";
import {
  buildWorldConfigBody,
  getEntity,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";
import { worldConfigBodySchema } from "@freeanima/habitat/core/db/schema";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";
import { testUserWorldId } from "../../helpers/world-context.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";
import { getActivePgTestContext, testConv } from "../../helpers/pg-test.ts";

function testCfg() {
  const ctx = getActivePgTestContext();
  if (!ctx) throw new Error("PG test context not initialized");
  return ctx.config.data;
}

async function setUserWorldGrants(
  grants: { subject_id: number; permission: "read" | "write" }[],
): Promise<void> {
  const worldId = testUserWorldId();
  const row = await getEntity(worldId);
  expect(row?.type).toBe("world");
  const parsed = worldConfigBodySchema.parse(row!.body);
  const body = buildWorldConfigBody(
    omitUndefined({
      private: parsed.private,
      owner_subject_id: parsed.owner_subject_id,
      default_private: parsed.default_private,
      grants,
    }),
  );
  await updateEntity({ id: worldId, body });
}

describePg("world grants tools", () => {
  const prev = process.env.FREEANIMA_HOME;
  let toolSets: ToolSetRegistry;

  beforeEach(async () => {
    toolSets = new ToolSetRegistry();
    await beginIntegrationCase("anima-world-grants-");
    registerContentBlockTools(toolSets);
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("denies agent access to user private world without grant", async () => {
    const sid = "sess-grant-deny";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });
    await setUserWorldGrants([]);

    let out = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("diary_get")!;
        out = await Promise.resolve(
          tool.handler({ date: "2026-07-10", world_id: testUserWorldId() }),
        );
      },
      { tools: toolSets },
    );
    expect(out).toContain("cannot access world");
  });

  it("read grant allows get but not append; write grant allows append", async () => {
    const sid = "sess-grant-rw";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });
    const { agent_subject_id } = getResolvedWorldContext();

    await setUserWorldGrants([{ subject_id: agent_subject_id, permission: "read" }]);

    let readDeniedWrite = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("diary_append")!;
        readDeniedWrite = await Promise.resolve(
          tool.handler({
            content: "should fail",
            date: "2026-07-11",
            world_id: testUserWorldId(),
          }),
        );
      },
      { tools: toolSets },
    );
    expect(readDeniedWrite).toContain("cannot write world");

    let readOk = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("diary_get")!;
        readOk = await Promise.resolve(
          tool.handler({ date: "2026-07-11", world_id: testUserWorldId() }),
        );
      },
      { tools: toolSets },
    );
    // entry may be missing but access must succeed (not access error)
    expect(readOk).not.toContain("cannot access world");
    expect(readOk).not.toContain("cannot write world");

    await setUserWorldGrants([{ subject_id: agent_subject_id, permission: "write" }]);

    let writeOk = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("diary_append")!;
        writeOk = await Promise.resolve(
          tool.handler({
            content: "agent via write grant",
            date: "2026-07-11",
            world_id: testUserWorldId(),
          }),
        );
      },
      { tools: toolSets },
    );
    expect(JSON.parse(writeOk).ok).toBe(true);

    let getAfter = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("diary_get")!;
        getAfter = await Promise.resolve(
          tool.handler({ date: "2026-07-11", world_id: testUserWorldId() }),
        );
      },
      { tools: toolSets },
    );
    const parsed = JSON.parse(getAfter) as {
      ok: boolean;
      item: { blocks: Array<{ content: string }> };
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.item.blocks.map((b) => b.content).join("\n")).toContain("agent via write grant");
  });

  it("subject_kind=user denies agent without grant; allows with read grant", async () => {
    const sid = "sess-grant-subject-kind";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });
    const { agent_subject_id } = getResolvedWorldContext();

    await setUserWorldGrants([]);

    let denied = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("diary_get")!;
        denied = await Promise.resolve(tool.handler({ subject_kind: "user", date: "2026-07-12" }));
      },
      { tools: toolSets, subjectId: agent_subject_id },
    );
    expect(denied).toContain("cannot access world");

    await setUserWorldGrants([{ subject_id: agent_subject_id, permission: "read" }]);

    let allowed = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("diary_get")!;
        allowed = await Promise.resolve(tool.handler({ subject_kind: "user", date: "2026-07-12" }));
      },
      { tools: toolSets, subjectId: agent_subject_id },
    );
    expect(allowed).not.toContain("cannot access world");
    expect(allowed).not.toContain("cannot write world");
  });
});
