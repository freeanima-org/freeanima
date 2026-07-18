import { afterEach, beforeEach, expect, it } from "bun:test";

import { TASK_ITEM_COMPONENT } from "@freeanima/core/db/schema/entity";
import { createTaskItem, createTaskList, searchTaskItems } from "@freeanima/features/task/domain";
import { createTag } from "@freeanima/features/tag/domain";
import { createDiaryEntry, searchDiaryEntries } from "@freeanima/features/diary/domain";
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

  it("filters task_item by tag_ids in SQL", async () => {
    const worldId = testUserWorldId();
    const list = await createTaskList(worldId, { name: "搜索测试" });
    const work = await createTag(worldId, { title: "工作" });
    const life = await createTag(worldId, { title: "生活" });
    await createTaskItem(worldId, { title: "部署上线", tag_ids: [work.id], list_id: list.id });
    await createTaskItem(worldId, { title: "买菜", tag_ids: [life.id], list_id: list.id });

    const hits = await searchEntities({
      world_id: worldId,
      primary_component: TASK_ITEM_COMPONENT,
      tag_ids: [work.id],
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

  it("searchDiaryEntries finds entries via text block hybrid search", async () => {
    const worldId = testUserWorldId();
    // 精确整句命中应优于「query + 长尾巴」弱命中（标题不再参与 diary hybrid）
    const exact = await createDiaryEntry(
      { worldId },
      {
        title: "旧日回忆",
        content: "排序测试专用项目",
        entry_at: "2020-01-01T12:00:00+08:00",
      },
    );
    const weak = await createDiaryEntry(
      { worldId },
      {
        title: "近期总结",
        content: "阶段复盘旁注与其他日常琐事，文末略提排序测试专用项目启动与收尾说明",
        entry_at: "2026-06-01T12:00:00+08:00",
      },
    );

    const domain = await searchDiaryEntries({ worldId }, { query: "排序测试专用项目", limit: 10 });
    expect(domain.map((row) => row.id)).toContain(exact.id);
    expect(domain.map((row) => row.id)).toContain(weak.id);
    expect(domain[0]?.id).toBe(exact.id);
  });

  it("createDiaryEntry with client_op_id is idempotent (client_op_id filter lookup)", async () => {
    const worldId = testUserWorldId();
    const first = await createDiaryEntry(
      { worldId },
      {
        title: "幂等测试",
        content: "第一次写入",
        entry_at: "2026-07-13T12:00:00+08:00",
        client_op_id: "diary-op-idem-1",
      },
    );
    const second = await createDiaryEntry(
      { worldId },
      {
        title: "幂等测试重放",
        content: "重复提交",
        entry_at: "2026-07-13T12:00:00+08:00",
        client_op_id: "diary-op-idem-1",
      },
    );
    expect(second.id).toBe(first.id);
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
