import { afterEach, beforeEach, expect, it } from "bun:test";

import { TASK_ITEM_COMPONENT, DIARY_ENTRY_COMPONENT } from "@freeanima/core/db/schema/entity";
import { createTaskItem, createTaskList, searchTaskItems } from "@freeanima/feature-task/domain";
import { createDiaryEntry, searchDiaryEntries } from "@freeanima/feature-diary/domain";
import { EntitySearchScopeError, searchEntities } from "@freeanima/core/db/pg/entity";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { testUserWorldId } from "../../helpers/world-context.ts";

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
    const worldId = testUserWorldId();
    const list = await createTaskList(worldId, { name: "搜索测试" });
    await createTaskItem(worldId, { title: "部署上线", tags: ["工作"], list_id: list.id });
    await createTaskItem(worldId, { title: "买菜", tags: ["生活"], list_id: list.id });

    const hits = await searchEntities({
      world_id: worldId,
      primary_component: TASK_ITEM_COMPONENT,
      filters: { tags: ["工作"] },
      mode: "filter_only",
    });
    expect(hits.results.some((r) => r.title === "部署上线")).toBe(true);
    expect(hits.results.every((r) => r.title !== "买菜")).toBe(true);
  });

  it("hybrid search finds task by query", async () => {
    const worldId = testUserWorldId();
    const list = await createTaskList(worldId, { name: "FTS" });
    await createTaskItem(worldId, {
      title: "架构文档",
      content: "实体复合搜索设计",
      list_id: list.id,
    });

    const hits = await searchEntities({
      world_id: worldId,
      primary_component: TASK_ITEM_COMPONENT,
      query: "架构",
      mode: "hybrid",
      limit: 5,
    });
    expect(hits.results.some((r) => r.title === "架构文档")).toBe(true);
  });

  it("searchTaskItems preserves hybrid relevance order", async () => {
    const worldId = testUserWorldId();
    const list = await createTaskList(worldId, { name: "排序测试" });
    await createTaskItem(worldId, {
      title: "Beta 杂项",
      content: "排序测试专用架构相关笔记",
      list_id: list.id,
      sort_order: 0,
    });
    await createTaskItem(worldId, {
      title: "排序测试专用架构文档",
      content: "设计说明",
      list_id: list.id,
      sort_order: 99,
    });

    const raw = await searchEntities({
      world_id: worldId,
      primary_component: TASK_ITEM_COMPONENT,
      query: "排序测试专用架构",
      mode: "hybrid",
      limit: 10,
    });
    const domain = await searchTaskItems(worldId, { query: "排序测试专用架构", limit: 10 });
    expect(domain.map((row) => row.id)).toEqual(raw.results.map((row) => row.id));
  });

  it("searchDiaryEntries preserves hybrid relevance order", async () => {
    const worldId = testUserWorldId();
    await createDiaryEntry(
      { worldId },
      {
        title: "旧日回忆",
        content: "排序测试专用项目启动记录",
        entry_at: "2020-01-01T12:00:00+08:00",
      },
    );
    await createDiaryEntry(
      { worldId },
      {
        title: "排序测试专用项目总结",
        content: "阶段复盘",
        entry_at: "2026-06-01T12:00:00+08:00",
      },
    );

    const raw = await searchEntities({
      world_id: worldId,
      primary_component: DIARY_ENTRY_COMPONENT,
      query: "排序测试专用项目",
      mode: "hybrid",
      limit: 10,
    });
    const domain = await searchDiaryEntries({ worldId }, { query: "排序测试专用项目", limit: 10 });
    expect(domain.map((row) => row.id)).toEqual(raw.results.map((row) => row.id));
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
    const worldId = testUserWorldId();
    const result = await searchEntities({
      global: true,
      accessible_world_ids: [worldId],
      primary_component: TASK_ITEM_COMPONENT,
      mode: "filter_only",
      limit: 5,
    });
    expect(result.count).toBeGreaterThanOrEqual(0);
  });
});
