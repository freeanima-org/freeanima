import { describe, expect, test } from "bun:test";

import {
  animaUriToShellPath,
  defaultPresentForComponent,
  formatAnimaUri,
  parseAnimaUri,
} from "./anima-uri.ts";

describe("anima-uri", () => {
  test("format ↔ parse round-trip", () => {
    const formatted = formatAnimaUri({
      id: 42,
      component: "task_item",
      present: "overlay",
    });
    expect(formatted).toBe("anima:42?component=task_item&present=overlay");
    const parsed = parseAnimaUri(formatted);
    expect(parsed).toEqual({
      ok: true,
      ref: { id: 42, component: "task_item", present: "overlay" },
    });
  });

  test("id-only anima uri", () => {
    expect(parseAnimaUri("anima:42")).toEqual({ ok: true, ref: { id: 42 } });
    expect(formatAnimaUri({ id: 42 })).toBe("anima:42");
  });

  test("rejects anima://", () => {
    expect(parseAnimaUri("anima://42").ok).toBe(false);
    expect(parseAnimaUri("anima://42?component=task_item").ok).toBe(false);
  });

  test("rejects invalid id and present", () => {
    expect(parseAnimaUri("anima:0").ok).toBe(false);
    expect(parseAnimaUri("anima:abc").ok).toBe(false);
    expect(parseAnimaUri("anima:42?present=popup").ok).toBe(false);
    expect(parseAnimaUri("anima:42?component=").ok).toBe(false);
  });

  test("default present by component", () => {
    expect(defaultPresentForComponent("task_item")).toBe("overlay");
    expect(defaultPresentForComponent("task_list")).toBe("navigate");
    expect(defaultPresentForComponent(undefined)).toBe("overlay");
    expect(defaultPresentForComponent("calendar_event")).toBe("overlay");
  });

  test("animaUriToShellPath and shell path parse", () => {
    expect(animaUriToShellPath({ id: 42, component: "task_item", present: "overlay" })).toBe(
      "/tasks?item=42&present=overlay",
    );
    expect(animaUriToShellPath({ id: 7, component: "task_list" })).toBe("/tasks?list=7");
    expect(animaUriToShellPath({ id: 42 })).toBeNull();

    expect(parseAnimaUri("/tasks?item=42&present=overlay")).toEqual({
      ok: true,
      ref: { id: 42, component: "task_item", present: "overlay" },
    });
    expect(parseAnimaUri("/tasks?list=9")).toEqual({
      ok: true,
      ref: { id: 9, component: "task_list", present: "navigate" },
    });
  });

  test("same id different component are distinct registry keys (documented via format)", () => {
    const a = formatAnimaUri({ id: 1, component: "task_item" });
    const b = formatAnimaUri({ id: 1, component: "task_list" });
    expect(a).not.toBe(b);
    expect(parseAnimaUri(a)).toMatchObject({
      ok: true,
      ref: { id: 1, component: "task_item" },
    });
    expect(parseAnimaUri(b)).toMatchObject({
      ok: true,
      ref: { id: 1, component: "task_list" },
    });
  });
});
