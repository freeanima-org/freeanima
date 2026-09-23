import { afterEach, describe, expect, mock, test } from "bun:test";

import type { AnimaUriRef } from "./anima-uri.ts";

type EntityResult = { ok: true; mode: "overlay" | "navigate" } | { ok: false; error: string };

const calls: string[] = [];
let entityResult: EntityResult = { ok: true, mode: "overlay" };

const openEntityOriginal = await import("./open-entity-resource.ts");
const moduleSelectionOriginal = await import("./module-selection.ts");
const pomodoroLaunchOriginal = await import("./pomodoro-launch.ts");

function installMocks(): void {
  mock.module("./pomodoro-launch.ts", () => ({
    ...pomodoroLaunchOriginal,
    navigateAppModulePath: (path: string) => {
      calls.push(`path:${path}`);
    },
  }));
  mock.module("./module-selection.ts", () => ({
    ...moduleSelectionOriginal,
    writeModuleSelection: (module: string, value: unknown) => {
      calls.push(`sel:${module}:${JSON.stringify(value)}`);
    },
  }));
  mock.module("./open-entity-resource.ts", () => ({
    ...openEntityOriginal,
    openEntityResource: async (ref: AnimaUriRef) => {
      calls.push(`entity:${JSON.stringify(ref)}`);
      return entityResult;
    },
  }));
}

async function loadModule(): Promise<typeof import("./notification-link.ts")> {
  return import("./notification-link.ts");
}

afterEach(() => {
  calls.length = 0;
  entityResult = { ok: true, mode: "overlay" };
  mock.restore();
  installMocks();
});

installMocks();

describe("openNotificationLink", () => {
  test("先写容器选型，再导航模块，最后开实体", async () => {
    const { openNotificationLink } = await loadModule();
    const result = await openNotificationLink({
      path: "/tasks?list=3",
      container: { module: "tasks", list_id: 3 },
      entity: { id: 7, component: "task_item", present: "overlay" },
    });
    expect(result).toEqual({ ok: true, mode: "overlay" });
    expect(calls).toEqual([
      'sel:tasks:{"kind":"list","id":3}',
      "path:/tasks?list=3",
      'entity:{"id":7,"component":"task_item","present":"overlay"}',
    ]);
  });

  test("项目 / 邮件容器映射", async () => {
    const { openNotificationLink } = await loadModule();
    await openNotificationLink({
      path: "/projects?project=5",
      container: { module: "project", project_id: 5 },
      entity: { id: 7, component: "task_item" },
    });
    await openNotificationLink({
      path: "/email?account=2",
      container: { module: "email", account_id: 2, message_id: 11 },
    });
    expect(calls).toEqual([
      "sel:project:5",
      "path:/projects?project=5",
      'entity:{"id":7,"component":"task_item"}',
      'sel:email:{"accountId":2,"messageId":11}',
      "path:/email?account=2",
    ]);
  });

  test("智能清单容器", async () => {
    const { openNotificationLink } = await loadModule();
    await openNotificationLink({
      container: { module: "tasks", smart_list_key: "today" },
    });
    expect(calls).toEqual(['sel:tasks:{"kind":"smart_list","key":"today"}']);
  });

  test("只有 path 时返回 navigate", async () => {
    const { openNotificationLink } = await loadModule();
    expect(await openNotificationLink({ path: "/habitat/cron" })).toEqual({
      ok: true,
      mode: "navigate",
    });
    expect(calls).toEqual(["path:/habitat/cron"]);
  });

  test("实体浮层失败时透出错误", async () => {
    entityResult = { ok: false, error: "实体浮层未就绪，请稍后重试" };
    const { openNotificationLink } = await loadModule();
    expect(await openNotificationLink({ entity: { id: 7 } })).toEqual({
      ok: false,
      error: "实体浮层未就绪，请稍后重试",
    });
  });

  test("空目标返回错误", async () => {
    const { openNotificationLink } = await loadModule();
    expect(await openNotificationLink({})).toEqual({ ok: false, error: "通知缺少跳转目标" });
    expect(calls).toEqual([]);
  });
});
