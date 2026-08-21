import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { SELF_BLOCK_KEYS } from "@freeanima/habitat/core/db/pg/self-layer/types";
import {
  getSelfBlock,
  listSelfBlocks,
  updateSelfBlock,
  upsertSelfBlock,
} from "@freeanima/habitat/core/db/pg/self-layer";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";

describePg("self layer PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-self-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("self_block entities CRUD + locked existence_anchor", async () => {
    const agentId = getResolvedWorldContext().default_chat_agent_subject_id;
    await upsertSelfBlock(
      {
        block_key: "self_model",
        content: "I am a test agent.",
        updated_by: "test",
      },
      agentId,
    );

    const row = await getSelfBlock("self_model", agentId);
    expect(row?.content).toBe("I am a test agent.");
    expect(row?.version).toBeGreaterThanOrEqual(1);

    const blocks = await listSelfBlocks(agentId);
    expect(blocks.map((b) => b.block_key)).toEqual([...SELF_BLOCK_KEYS]);

    await upsertSelfBlock(
      {
        block_key: "existence_anchor",
        content: "existence anchor content",
        locked: true,
        updated_by: "test",
      },
      agentId,
    );

    await expect(
      updateSelfBlock({ block_key: "existence_anchor", content: "tamper" }, agentId),
    ).rejects.toThrow(/locked/i);

    await updateSelfBlock(
      { block_key: "existence_anchor", content: "explicit update", updated_by: "test" },
      agentId,
      { force: true },
    );
    const anchor = await getSelfBlock("existence_anchor", agentId);
    expect(anchor?.content).toBe("explicit update");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
