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
  closeTaskList,
  deleteTaskList,
  getDefaultTaskList,
  listTaskItems,
  listTaskLists,
  listTaskListStats,
  reopenTaskList,
  updateTaskItem,
  updateTaskList,
} from "@freeanima/features/task/domain";
import { getEntity } from "@freeanima/core/db/pg/entity";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { testUserWorldId, testAgentWorldId } from "../../helpers/world-context.ts";

describePg("entity task PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-entity-task-");
  });

  afterEach(async () => {
    await endIntegrationCase();
    await restoreIntegrationHome(prev);
  });

  it("creates task_list and task_item entities with title/content columns", async () => {
    const worldId = testUserWorldId();
    const list = await createTaskList(worldId, { name: "工作" });
    expect(list.name).toBe("工作");
    expect(list.item_count).toBeUndefined();
    expect(await listTaskListStats(worldId)).toContainEqual({ id: list.id, item_count: 0 });

    const item = await createTaskItem(worldId, {
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

    const listRow = await getEntity(list.id);
    expect(listRow?.primary_component).toBe(TASK_LIST_COMPONENT);
    expect(listRow?.title).toBe("工作");
    expect(asTaskList(listRow!)).toMatchObject({ name: "工作" });

    const itemRow = await getEntity(item.id);
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
    const worldId = testUserWorldId();
    const list = await createTaskList(worldId, { name: "个人" });
    await createTaskItem(worldId, { title: "买菜", list_id: list.id });
    const second = await createTaskItem(worldId, {
      title: "运动",
      list_id: list.id,
      tags: ["健康"],
    });

    let items = await listTaskItems(worldId, { list_id: list.id, status: "pending" });
    expect(items).toHaveLength(2);

    const done = await completeTaskItem(worldId, second.id);
    expect(done?.status).toBe("completed");

    items = await listTaskItems(worldId, { list_id: list.id, status: "pending", tags: ["健康"] });
    expect(items).toHaveLength(0);

    items = await listTaskItems(worldId, { list_id: list.id, status: "pending" });
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("买菜");

    const lists = await listTaskLists(worldId);
    expect(lists.find((l) => l.id === list.id)?.item_count).toBeUndefined();
    expect(await listTaskListStats(worldId)).toContainEqual({ id: list.id, item_count: 1 });
  });

  it("closes and reopens task lists; default list cannot be closed", async () => {
    const worldId = testUserWorldId();
    const list = await createTaskList(worldId, { name: "归档测试" });
    const defaultList = await getDefaultTaskList(worldId);

    let visible = await listTaskLists(worldId);
    expect(visible.some((l) => l.id === list.id)).toBe(true);

    const closed = await closeTaskList(worldId, list.id);
    expect(closed?.closed).toBe(true);

    visible = await listTaskLists(worldId);
    expect(visible.some((l) => l.id === list.id)).toBe(false);

    const all = await listTaskLists(worldId, { includeClosed: true });
    expect(all.some((l) => l.id === list.id && l.closed)).toBe(true);

    const reopened = await reopenTaskList(worldId, list.id);
    expect(reopened?.closed).toBe(false);

    await expect(updateTaskList(worldId, { id: defaultList.id, closed: true })).rejects.toThrow(
      "default task list cannot be closed",
    );
  });

  it("archive detaches list from folder", async () => {
    const worldId = testUserWorldId();
    const folder = await createTaskList(worldId, { name: "文件夹", is_folder: true });
    const list = await createTaskList(worldId, { name: "子清单", parent_id: folder.id });
    expect(list.parent_id).toBe(folder.id);

    const closed = await closeTaskList(worldId, list.id);
    expect(closed?.closed).toBe(true);
    expect(closed?.parent_id).toBeNull();

    const all = await listTaskLists(worldId, { includeClosed: true });
    expect(all.find((l) => l.id === list.id)?.parent_id).toBeNull();
  });

  it("creates nested folders and lists; rejects tasks on folders", async () => {
    const worldId = testUserWorldId();
    const folder = await createTaskList(worldId, { name: "工作", is_folder: true });
    expect(folder.is_folder).toBe(true);
    expect(folder.parent_id).toBeNull();
    expect(folder.item_count).toBeUndefined();

    const childList = await createTaskList(worldId, { name: "项目A", parent_id: folder.id });
    expect(childList.parent_id).toBe(folder.id);
    expect(childList.is_folder).toBe(false);

    const nestedFolder = await createTaskList(worldId, {
      name: "Q2",
      is_folder: true,
      parent_id: folder.id,
    });
    expect(nestedFolder.parent_id).toBe(folder.id);

    const deepList = await createTaskList(worldId, { name: "子项", parent_id: nestedFolder.id });
    expect(deepList.parent_id).toBe(nestedFolder.id);

    await expect(
      createTaskItem(worldId, { title: "不应成功", list_id: folder.id }),
    ).rejects.toThrow("tasks cannot be assigned to a folder");

    const item = await createTaskItem(worldId, { title: "合法任务", list_id: childList.id });
    expect(item.list_id).toBe(childList.id);

    const lists = await listTaskLists(worldId);
    expect(lists.find((l) => l.id === folder.id)?.is_folder).toBe(true);
    expect(lists.find((l) => l.id === childList.id)?.parent_id).toBe(folder.id);
  });

  it("rejects folder cycle and invalid parent", async () => {
    const worldId = testUserWorldId();
    const folderA = await createTaskList(worldId, { name: "A", is_folder: true });
    const folderB = await createTaskList(worldId, {
      name: "B",
      is_folder: true,
      parent_id: folderA.id,
    });

    await expect(
      updateTaskList(worldId, { id: folderA.id, parent_id: folderB.id }),
    ).rejects.toThrow("cycle");

    const plainList = await createTaskList(worldId, { name: "清单" });
    await expect(
      updateTaskList(worldId, { id: plainList.id, parent_id: plainList.id }),
    ).rejects.toThrow("own parent");
  });

  it("dissolves nested folders on delete; all lists move to root", async () => {
    const worldId = testUserWorldId();
    const folder = await createTaskList(worldId, { name: "待删文件夹", is_folder: true });
    const nestedFolder = await createTaskList(worldId, {
      name: "子夹",
      is_folder: true,
      parent_id: folder.id,
    });
    const list = await createTaskList(worldId, { name: "待留清单", parent_id: folder.id });
    const deepList = await createTaskList(worldId, {
      name: "深层清单",
      parent_id: nestedFolder.id,
    });
    const item = await createTaskItem(worldId, { title: "待留任务", list_id: list.id });

    const ok = await deleteTaskList(worldId, folder.id, { cascade: true });
    expect(ok).toBe(true);

    expect(await getEntity(folder.id)).toBeNull();
    expect(await getEntity(nestedFolder.id)).toBeNull();
    expect(asTaskList((await getEntity(list.id))!)?.parent_id).toBeNull();
    expect(asTaskList((await getEntity(deepList.id))!)?.parent_id).toBeNull();
    expect(await getEntity(item.id)).not.toBeNull();
  });

  it("deletes tasks when removing a non-folder list", async () => {
    const worldId = testUserWorldId();
    const list = await createTaskList(worldId, { name: "待删清单" });
    const item = await createTaskItem(worldId, { title: "待删任务", list_id: list.id });

    const ok = await deleteTaskList(worldId, list.id, { cascade: true });
    expect(ok).toBe(true);

    expect(await getEntity(list.id)).toBeNull();
    expect(await getEntity(item.id)).toBeNull();
  });

  it("rejects tasks and mutations on archived list", async () => {
    const worldId = testUserWorldId();
    const list = await createTaskList(worldId, { name: "归档清单" });
    const item = await createTaskItem(worldId, { title: "已有", list_id: list.id });
    await closeTaskList(worldId, list.id);

    await expect(createTaskItem(worldId, { title: "新建", list_id: list.id })).rejects.toThrow(
      "清单已归档",
    );

    await expect(updateTaskList(worldId, { id: list.id, name: "新名" })).rejects.toThrow(
      "清单已归档",
    );

    await expect(updateTaskList(worldId, { id: list.id, parent_id: null })).rejects.toThrow(
      "清单已归档",
    );

    await expect(updateTaskItem(worldId, { id: item.id, title: "改标题" })).rejects.toThrow(
      "清单已归档",
    );

    await expect(completeTaskItem(worldId, item.id)).rejects.toThrow("清单已归档");
  });

  it("folders cannot be archived", async () => {
    const worldId = testUserWorldId();
    const folder = await createTaskList(worldId, { name: "文件夹", is_folder: true });

    await expect(closeTaskList(worldId, folder.id)).rejects.toThrow("folders cannot be archived");
  });

  it("creates task_list in agent world when using agent world id", async () => {
    const worldId = testAgentWorldId();
    const list = await createTaskList(worldId, { name: "Agent 清单" });
    expect(list.name).toBe("Agent 清单");
    const lists = await listTaskLists(worldId);
    expect(lists.some((l) => l.id === list.id)).toBe(true);
  });
});
