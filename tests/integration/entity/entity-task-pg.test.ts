import { afterEach, beforeEach, expect, it } from "bun:test";

import {
  TASK_ITEM_COMPONENT,
  TASK_LIST_COMPONENT,
  asTaskItem,
  asTaskList,
} from "@freeanima/core/db/schema/entity";
import {
  createTaskItem,
  createTaskList,
  completeTaskItem,
  listTaskItems,
  listTaskLists,
  registerEntityTaskModule,
  resetEntityTaskModuleForTests,
} from "@freeanima/capabilities-task";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getTestEngine } from "../../helpers/pg-test.ts";

describePg("entity task PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-entity-task-");
    registerEntityTaskModule({ entityStore: getTestEngine().repos.entity });
  });

  afterEach(async () => {
    resetEntityTaskModuleForTests();
    await endIntegrationCase();
    await restoreIntegrationHome(prev);
  });

  it("creates task_list and task_item entities with title/content columns", async () => {
    const store = getTestEngine().repos.entity;

    const list = await createTaskList({ name: "工作" });
    expect(list.name).toBe("工作");
    expect(list.item_count).toBe(0);

    const item = await createTaskItem({
      title: "写文档",
      content: "第一章草稿",
      tags: ["文档", "优先"],
      list_id: list.id,
    });
    expect(item.title).toBe("写文档");
    expect(item.content).toBe("第一章草稿");
    expect(item.tags).toEqual(["文档", "优先"]);
    expect(item.status).toBe("pending");
    expect(item.list_id).toBe(list.id);

    const listRow = await store.get(list.id);
    expect(listRow?.primary_component).toBe(TASK_LIST_COMPONENT);
    expect(listRow?.title).toBe("工作");
    expect(asTaskList(listRow!)).toMatchObject({ name: "工作" });

    const itemRow = await store.get(item.id);
    expect(itemRow?.primary_component).toBe(TASK_ITEM_COMPONENT);
    expect(itemRow?.title).toBe("写文档");
    expect(itemRow?.content).toBe("第一章草稿");
    expect(asTaskItem(itemRow!)).toMatchObject({
      title: "写文档",
      content: "第一章草稿",
      list_id: list.id,
    });
  });

  it("lists and completes task items", async () => {
    const list = await createTaskList({ name: "个人" });
    await createTaskItem({ title: "买菜", list_id: list.id });
    const second = await createTaskItem({ title: "运动", list_id: list.id, tags: ["健康"] });

    let items = await listTaskItems({ list_id: list.id, status: "pending" });
    expect(items).toHaveLength(2);

    const done = await completeTaskItem(second.id);
    expect(done?.status).toBe("completed");

    items = await listTaskItems({ list_id: list.id, status: "pending", tags: ["健康"] });
    expect(items).toHaveLength(0);

    items = await listTaskItems({ list_id: list.id, status: "pending" });
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("买菜");

    const lists = await listTaskLists();
    expect(lists.find((l) => l.id === list.id)?.item_count).toBe(1);
  });
});
