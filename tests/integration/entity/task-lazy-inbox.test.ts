import { afterEach, beforeEach, expect, it } from "bun:test";

import {
  ensureDefaultTaskListForWorld,
  getDefaultTaskList,
  listTaskLists,
} from "@freeanima/features/task/domain";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { testUserWorldId } from "../../helpers/world-context.ts";

describePg("ensureDefaultTaskListForWorld", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-task-inbox-");
  });

  afterEach(async () => {
    await endIntegrationCase();
    await restoreIntegrationHome(prev);
  });

  it("creates default inbox lazily per world", async () => {
    const worldId = testUserWorldId();
    const before = await listTaskLists(worldId);
    expect(before.some((l) => l.is_default)).toBe(false);

    const inbox = await ensureDefaultTaskListForWorld(worldId);
    expect(inbox.is_default).toBe(true);
    expect(inbox.name.length).toBeGreaterThan(0);

    const again = await ensureDefaultTaskListForWorld(worldId);
    expect(again.id).toBe(inbox.id);

    const lists = await listTaskLists(worldId);
    expect(lists.filter((l) => l.is_default)).toHaveLength(1);
  });

  it("getDefaultTaskList ensures inbox", async () => {
    const worldId = testUserWorldId();
    const list = await getDefaultTaskList(worldId);
    expect(list.is_default).toBe(true);
  });

  it("concurrent ensure creates only one default inbox", async () => {
    const worldId = testUserWorldId();
    const before = await listTaskLists(worldId);
    expect(before.filter((l) => l.is_default)).toHaveLength(0);

    const results = await Promise.all([
      ensureDefaultTaskListForWorld(worldId),
      ensureDefaultTaskListForWorld(worldId),
      ensureDefaultTaskListForWorld(worldId),
      ensureDefaultTaskListForWorld(worldId),
    ]);

    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(1);

    const lists = await listTaskLists(worldId);
    expect(lists.filter((l) => l.is_default)).toHaveLength(1);
    expect(lists.find((l) => l.is_default)?.id).toBe(results[0]?.id);
  });
});
