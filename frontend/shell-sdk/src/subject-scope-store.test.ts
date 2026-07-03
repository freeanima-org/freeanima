import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { SUBJECT_SCOPE_STORAGE_KEY } from "./subject-scope.ts";
import {
  getSubjectKind,
  resetSubjectScopeForTest,
  setSubjectKind,
  subscribeSubjectKind,
} from "./subject-scope-store.ts";

describe("subject-scope-store", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    globalThis.sessionStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    } as Storage;
    resetSubjectScopeForTest();
  });

  afterEach(() => {
    resetSubjectScopeForTest();
  });

  it("defaults to user", () => {
    expect(getSubjectKind()).toBe("user");
  });

  it("persists kind in sessionStorage", () => {
    setSubjectKind("agent");
    expect(getSubjectKind()).toBe("agent");
    expect(sessionStorage.getItem(SUBJECT_SCOPE_STORAGE_KEY)).toBe("agent");
    resetSubjectScopeForTest();
    setSubjectKind("agent");
    setSubjectKind("user");
    expect(sessionStorage.getItem(SUBJECT_SCOPE_STORAGE_KEY)).toBe("user");
  });

  it("notifies subscribers on change", () => {
    let calls = 0;
    const unsub = subscribeSubjectKind(() => {
      calls += 1;
    });
    setSubjectKind("agent");
    setSubjectKind("agent");
    setSubjectKind("user");
    unsub();
    expect(calls).toBe(2);
  });
});
