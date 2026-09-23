import { describe, expect, test } from "bun:test";

import {
  calendarEventNotificationLink,
  describeNotificationLink,
  emailNotificationLink,
  habitNotificationLink,
  notificationLinkFromInput,
  parseNotificationLink,
  shellPathNotificationLink,
  taskItemNotificationLink,
} from "./index.ts";

describe("parseNotificationLink", () => {
  test("解析合法对象", () => {
    expect(
      parseNotificationLink({
        path: "/tasks?list=3",
        container: { module: "tasks", list_id: 3 },
        entity: { id: 7, component: "task_item", present: "overlay" },
      }),
    ).toEqual({
      path: "/tasks?list=3",
      container: { module: "tasks", list_id: 3 },
      entity: { id: 7, component: "task_item", present: "overlay" },
    });
  });

  test("非法输入一律 null", () => {
    expect(parseNotificationLink(null)).toBeNull();
    expect(parseNotificationLink(undefined)).toBeNull();
    expect(parseNotificationLink("anima:1")).toBeNull();
    expect(parseNotificationLink({ entity: { id: 0 } })).toBeNull();
    expect(parseNotificationLink({ container: { module: "nope" } })).toBeNull();
    expect(parseNotificationLink({ path: "" })).toBeNull();
  });

  test("未知键被剥离", () => {
    expect(parseNotificationLink({ path: "/chat", extra: 1 })).toEqual({ path: "/chat" });
  });
});

describe("builders", () => {
  test("任务：清单侧带 list + module-selection", () => {
    expect(taskItemNotificationLink({ id: 7, listId: 3 })).toEqual({
      path: "/tasks?list=3",
      container: { module: "tasks", list_id: 3 },
      entity: { id: 7, component: "task_item", present: "overlay" },
    });
  });

  test("任务：项目侧优先 project", () => {
    expect(taskItemNotificationLink({ id: 7, listId: 3, projectId: 5 })).toEqual({
      path: "/projects?project=5",
      container: { module: "project", project_id: 5 },
      entity: { id: 7, component: "task_item", present: "overlay" },
    });
  });

  test("任务：无容器时退回模块根", () => {
    expect(taskItemNotificationLink({ id: 7 })).toEqual({
      path: "/tasks",
      entity: { id: 7, component: "task_item", present: "overlay" },
    });
  });

  test("日程 / 习惯走浮层实体", () => {
    expect(calendarEventNotificationLink(9)).toEqual({
      path: "/calendar",
      entity: { id: 9, component: "calendar_event", present: "overlay" },
    });
    expect(habitNotificationLink(4)).toEqual({
      path: "/habits",
      entity: { id: 4, component: "habit", present: "overlay" },
    });
  });

  test("邮件带账户容器与可选邮件 id", () => {
    expect(emailNotificationLink({ accountId: 2, messageId: 11 })).toEqual({
      path: "/email?account=2",
      container: { module: "email", account_id: 2, message_id: 11 },
    });
    expect(emailNotificationLink({ accountId: 2 })).toEqual({
      path: "/email?account=2",
      container: { module: "email", account_id: 2 },
    });
  });

  test("shell path 归一化", () => {
    expect(shellPathNotificationLink("/habitat/cron")).toEqual({ path: "/habitat/cron" });
    expect(shellPathNotificationLink("habitat/cron")).toEqual({ path: "/habitat/cron" });
  });
});

describe("notificationLinkFromInput", () => {
  test("shell path 原样保留", () => {
    expect(notificationLinkFromInput("/tasks?list=3&item=7")).toEqual({
      path: "/tasks?list=3&item=7",
    });
    expect(notificationLinkFromInput("  /calendar?event=9  ")).toEqual({
      path: "/calendar?event=9",
    });
  });

  test("导航态组件直接给 path", () => {
    expect(notificationLinkFromInput("anima:3?component=task_list")).toEqual({
      path: "/tasks?list=3",
    });
    expect(notificationLinkFromInput("anima:5?component=project")).toEqual({
      path: "/projects?project=5",
    });
  });

  test("浮层态组件给模块根 + 实体", () => {
    expect(notificationLinkFromInput("anima:7?component=task_item")).toEqual({
      path: "/tasks",
      entity: { id: 7, component: "task_item", present: "overlay" },
    });
  });

  test("未知组件只给实体", () => {
    expect(notificationLinkFromInput("anima:4?component=habit")).toEqual({
      entity: { id: 4, component: "habit", present: "overlay" },
    });
  });

  test("无 component 走通用实体浮层", () => {
    expect(notificationLinkFromInput("anima:12")).toEqual({
      entity: { id: 12, present: "overlay" },
    });
  });

  test("非法输入 null", () => {
    expect(notificationLinkFromInput("")).toBeNull();
    expect(notificationLinkFromInput("https://example.com")).toBeNull();
    expect(notificationLinkFromInput("anima://1")).toBeNull();
  });
});

describe("describeNotificationLink", () => {
  test("拼出模块 / 容器 / 实体", () => {
    expect(describeNotificationLink(taskItemNotificationLink({ id: 7, listId: 3 }))).toBe(
      "/tasks?list=3 → 容器 tasks → task_item:7",
    );
    expect(describeNotificationLink({})).toBe("无跳转目标");
  });
});
