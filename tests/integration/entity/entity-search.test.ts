import { afterEach, beforeEach, expect, it } from "bun:test";

import { TASK_ITEM_COMPONENT } from "@freeanima/core/db/schema/entity";
import { createTaskItem, createTaskList } from "@freeanima/capabilities-task";
import { EntitySearchScopeError, searchEntities } from "@freeanima/core/db/pg/entity";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

describePg("entity search PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-entity-search-");
  });

  afterEach(async () => {
    await endIntegrationCase();
    await restoreIntegrationHome(prev);
  });

  it("filters task_item by status and tags in SQL", async () => {
    const list = await createTaskList({ name: "搜索测试" });
    await createTaskItem({ title: "部署上线", tags: ["工作"], list_id: list.id });
    await createTaskItem({ title: "买菜", tags: ["生活"], list_id: list.id });

    const hits = await searchEntities({
      world_id: 1,
      primary_component: TASK_ITEM_COMPONENT,
      filters: { tags: ["工作"] },
      mode: "filter_only",
    });
    expect(hits.results.some((r) => r.title === "部署上线")).toBe(true);
    expect(hits.results.every((r) => r.title !== "买菜")).toBe(true);
  });

  it("hybrid search finds task by query", async () => {
    const list = await createTaskList({ name: "FTS" });
    await createTaskItem({
      title: "架构文档",
      content: "实体复合搜索设计",
      list_id: list.id,
    });

    const hits = await searchEntities({
      world_id: 1,
      primary_component: TASK_ITEM_COMPONENT,
      query: "架构",
      mode: "hybrid",
      limit: 5,
    });
    expect(hits.results.some((r) => r.title === "架构文档")).toBe(true);
  });

  it("global search without accessible worlds throws scope error", async () => {
    await expect(
      searchEntities({
        global: true,
        query: "test",
      }),
    ).rejects.toBeInstanceOf(EntitySearchScopeError);
  });

  it("global search with public world ids succeeds", async () => {
    const result = await searchEntities({
      global: true,
      accessible_world_ids: [1],
      primary_component: TASK_ITEM_COMPONENT,
      mode: "filter_only",
      limit: 5,
    });
    expect(result.count).toBeGreaterThanOrEqual(0);
  });
});
