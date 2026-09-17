import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  readLocationSearchParams,
  readTaskSelectionFromUrl,
  taskSelectionEquals,
  writeTaskSelectionToUrl,
} from "./task-selection-url.ts";

type Loc = { pathname: string; search: string; hash: string; href: string };

function hrefOf(loc: Loc): string {
  return `http://localhost${loc.pathname}${loc.search}${loc.hash}`;
}

function installWindowMock(initial: Partial<Loc> = {}): Loc {
  const loc: Loc = {
    pathname: initial.pathname ?? "/",
    search: initial.search ?? "",
    hash: initial.hash ?? "",
    href: "",
  };
  loc.href = hrefOf(loc);

  const history = {
    replaceState(_state: unknown, _title: string, url?: string | URL | null) {
      if (url == null) return;
      const next = typeof url === "string" ? new URL(url, "http://localhost") : url;
      loc.pathname = next.pathname;
      loc.search = next.search;
      loc.hash = next.hash;
      loc.href = hrefOf(loc);
    },
  };

  (globalThis as { window: Window }).window = {
    location: loc,
    history,
    portalShell: undefined,
  } as unknown as Window;

  return loc;
}

describe("task-selection-url", () => {
  let loc: Loc;

  beforeEach(() => {
    loc = installWindowMock();
  });

  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("从 location.search 读取 list", () => {
    loc.pathname = "/tasks";
    loc.search = "?list=42";
    loc.hash = "";
    loc.href = hrefOf(loc);
    expect(readTaskSelectionFromUrl()).toEqual({ kind: "list", id: 42 });
    expect(readLocationSearchParams().get("list")).toBe("42");
  });

  it("原生 hash 路由从 #/tasks?list= 读取", () => {
    loc.pathname = "/";
    loc.search = "";
    loc.hash = "#/tasks?list=7";
    loc.href = hrefOf(loc);
    expect(readTaskSelectionFromUrl()).toEqual({ kind: "list", id: 7 });
  });

  it("hash 内 smart_list", () => {
    loc.pathname = "/";
    loc.search = "";
    loc.hash = "#/tasks?smart_list=due_today";
    loc.href = hrefOf(loc);
    expect(readTaskSelectionFromUrl()).toEqual({ kind: "smart_list", key: "due_today" });
  });

  it("taskSelectionEquals", () => {
    expect(taskSelectionEquals({ kind: "list", id: 1 }, { kind: "list", id: 1 })).toBe(true);
    expect(taskSelectionEquals({ kind: "list", id: 1 }, { kind: "list", id: 2 })).toBe(false);
    expect(
      taskSelectionEquals({ kind: "smart_list", key: "a" }, { kind: "smart_list", key: "a" }),
    ).toBe(true);
  });

  it("writeTaskSelectionToUrl 在 hash 路由下写入 hash query", () => {
    loc.pathname = "/";
    loc.search = "";
    loc.hash = "#/tasks?list=1";
    loc.href = hrefOf(loc);
    writeTaskSelectionToUrl({ kind: "list", id: 99 });
    expect(loc.hash).toContain("list=99");
    expect(readTaskSelectionFromUrl()).toEqual({ kind: "list", id: 99 });
  });
});
