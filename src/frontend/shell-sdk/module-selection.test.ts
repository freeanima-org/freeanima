import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  clearModuleSelection,
  readModuleSelection,
  resetModuleSelectionForTest,
  writeModuleSelection,
} from "./module-selection.ts";
import { setSubjectKind } from "./subject-scope-store.ts";

function mockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe("module-selection", () => {
  const ctx = { hubScope: "http://127.0.0.1:2658/sap", subjectKind: "user" as const };

  beforeEach(() => {
    globalThis.localStorage = mockLocalStorage();
    setSubjectKind("user");
  });

  afterEach(() => {
    resetModuleSelectionForTest();
  });

  test("chat 读写 conversationId", () => {
    writeModuleSelection("chat", "conv-1", ctx);
    expect(readModuleSelection("chat", ctx)).toBe("conv-1");
    clearModuleSelection("chat", ctx);
    expect(readModuleSelection("chat", ctx)).toBeNull();
  });

  test("tasks 读写 listId（兼容旧 number）", () => {
    writeModuleSelection("tasks", { kind: "list", id: 42 }, ctx);
    expect(readModuleSelection("tasks", ctx)).toEqual({ kind: "list", id: 42 });
    localStorage.setItem("freeanima.module-selection:http://127.0.0.1:2658/sap:user:tasks", "7");
    expect(readModuleSelection("tasks", ctx)).toEqual({ kind: "list", id: 7 });
  });

  test("tasks 读写 smart_list key", () => {
    writeModuleSelection("tasks", { kind: "smart_list", key: "due_today" }, ctx);
    expect(readModuleSelection("tasks", ctx)).toEqual({
      kind: "smart_list",
      key: "due_today",
    });
  });

  test("email 读写 accountId 与 messageId", () => {
    writeModuleSelection("email", { accountId: 3, messageId: 99 }, ctx);
    expect(readModuleSelection("email", ctx)).toEqual({ accountId: 3, messageId: 99 });
    writeModuleSelection("email", { accountId: 3, messageId: null }, ctx);
    expect(readModuleSelection("email", ctx)).toEqual({ accountId: 3 });
  });

  test("hub 与 subject 键隔离", () => {
    writeModuleSelection("chat", "a", ctx);
    writeModuleSelection("chat", "b", { ...ctx, subjectKind: "agent" });
    writeModuleSelection("chat", "c", { ...ctx, hubScope: "http://other/sap" });
    expect(readModuleSelection("chat", ctx)).toBe("a");
    expect(readModuleSelection("chat", { ...ctx, subjectKind: "agent" })).toBe("b");
    expect(readModuleSelection("chat", { ...ctx, hubScope: "http://other/sap" })).toBe("c");
  });

  test("非法 JSON 返回 null", () => {
    localStorage.setItem(
      "freeanima.module-selection:http://127.0.0.1:2658/sap:user:email",
      "not-json",
    );
    expect(readModuleSelection("email", ctx)).toBeNull();
  });
});
