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
  reopenTaskList,
  updateTaskList,
} from "@freeanima/capabilities-task";
import { getEntity } from "@freeanima/core/db/pg/entity";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

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

  it("closes and reopens task lists; default list cannot be closed", async () => {
    const list = await createTaskList({ name: "归档测试" });
    const defaultList = await getDefaultTaskList();
    expect(defaultList).not.toBeNull();

    let visible = await listTaskLists();
    expect(visible.some((l) => l.id === list.id)).toBe(true);

    const closed = await closeTaskList(list.id);
    expect(closed?.closed).toBe(true);

    visible = await listTaskLists();
    expect(visible.some((l) => l.id === list.id)).toBe(false);

    const all = await listTaskLists({ includeClosed: true });
    expect(all.some((l) => l.id === list.id && l.closed)).toBe(true);

    const reopened = await reopenTaskList(list.id);
    expect(reopened?.closed).toBe(false);

    await expect(updateTaskList({ id: defaultList!.id, closed: true })).rejects.toThrow(
      "default task list cannot be closed",
    );
  });

  it("creates nested folders and lists; rejects tasks on folders", async () => {
    const folder = await createTaskList({ name: "工作", is_folder: true });
    expect(folder.is_folder).toBe(true);
    expect(folder.parent_id).toBeNull();
    expect(folder.item_count).toBe(0);

    const childList = await createTaskList({ name: "项目A", parent_id: folder.id });
    expect(childList.parent_id).toBe(folder.id);
    expect(childList.is_folder).toBe(false);

    const nestedFolder = await createTaskList({
      name: "Q2",
      is_folder: true,
      parent_id: folder.id,
    });
    expect(nestedFolder.parent_id).toBe(folder.id);

    const deepList = await createTaskList({ name: "子项", parent_id: nestedFolder.id });
    expect(deepList.parent_id).toBe(nestedFolder.id);

    await expect(createTaskItem({ title: "不应成功", list_id: folder.id })).rejects.toThrow(
      "tasks cannot be assigned to a folder",
    );

    const item = await createTaskItem({ title: "合法任务", list_id: childList.id });
    expect(item.list_id).toBe(childList.id);

    const lists = await listTaskLists();
    expect(lists.find((l) => l.id === folder.id)?.is_folder).toBe(true);
    expect(lists.find((l) => l.id === childList.id)?.parent_id).toBe(folder.id);
  });

  it("rejects folder cycle and invalid parent", async () => {
    const folderA = await createTaskList({ name: "A", is_folder: true });
    const folderB = await createTaskList({ name: "B", is_folder: true, parent_id: folderA.id });

    await expect(updateTaskList({ id: folderA.id, parent_id: folderB.id })).rejects.toThrow(
      "cycle",
    );

    const plainList = await createTaskList({ name: "清单" });
    await expect(updateTaskList({ id: plainList.id, parent_id: plainList.id })).rejects.toThrow(
      "own parent",
    );
  });

  it("cascade deletes folder children and tasks", async () => {
    const folder = await createTaskList({ name: "待删文件夹", is_folder: true });
    const list = await createTaskList({ name: "待删清单", parent_id: folder.id });
    const item = await createTaskItem({ title: "待删任务", list_id: list.id });

    const ok = await deleteTaskList(folder.id, { cascade: true });
    expect(ok).toBe(true);

    expect(await getEntity(folder.id)).toBeNull();
    expect(await getEntity(list.id)).toBeNull();
    expect(await getEntity(item.id)).toBeNull();
  });

  it("cascade closes folder descendants", async () => {
    const folder = await createTaskList({ name: "归档夹", is_folder: true });
    const list = await createTaskList({ name: "归档清单", parent_id: folder.id });

    await closeTaskList(folder.id);

    const all = await listTaskLists({ includeClosed: true });
    expect(all.find((l) => l.id === folder.id)?.closed).toBe(true);
    expect(all.find((l) => l.id === list.id)?.closed).toBe(true);
  });
});
