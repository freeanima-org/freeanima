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

  test("habitat_instance_id round-trip", () => {
    const formatted = formatAnimaUri({
      id: 42,
      habitat_instance_id: "fa_inst_V1StGXR8_Z5jdHi6B-myT",
    });
    expect(formatted).toBe("anima:42?habitat_instance_id=fa_inst_V1StGXR8_Z5jdHi6B-myT");
    expect(parseAnimaUri(formatted)).toEqual({
      ok: true,
      ref: { id: 42, habitat_instance_id: "fa_inst_V1StGXR8_Z5jdHi6B-myT" },
    });
    expect(parseAnimaUri("anima:42?habitat_instance_id=").ok).toBe(false);
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
    expect(defaultPresentForComponent("project")).toBe("overlay");
    expect(defaultPresentForComponent("note")).toBe("navigate");
    expect(defaultPresentForComponent("diary_entry")).toBe("navigate");
    expect(defaultPresentForComponent("email_account")).toBe("navigate");
  });

  test("animaUriToShellPath and shell path parse", () => {
    expect(animaUriToShellPath({ id: 42, component: "task_item", present: "overlay" })).toBe(
      "/tasks?item=42&present=overlay",
    );
    expect(animaUriToShellPath({ id: 7, component: "task_list" })).toBe("/tasks?list=7");
    expect(animaUriToShellPath({ id: 11, component: "project" })).toBe("/projects?project=11");
    expect(animaUriToShellPath({ id: 22, component: "calendar_event" })).toBe("/calendar?event=22");
    expect(animaUriToShellPath({ id: 88, component: "note" })).toBe("/note?id=88");
    expect(animaUriToShellPath({ id: 5, component: "diary_entry" })).toBe("/diary?id=5");
    expect(animaUriToShellPath({ id: 3, component: "email_account" })).toBe("/email?account=3");
    expect(animaUriToShellPath({ id: 42 })).toBeNull();

    expect(parseAnimaUri("/tasks?item=42&present=overlay")).toEqual({
      ok: true,
      ref: { id: 42, component: "task_item", present: "overlay" },
    });
    expect(parseAnimaUri("/tasks?list=9")).toEqual({
      ok: true,
      ref: { id: 9, component: "task_list", present: "navigate" },
    });
    expect(parseAnimaUri("/projects?project=11")).toEqual({
      ok: true,
      ref: { id: 11, component: "project", present: "navigate" },
    });
    expect(parseAnimaUri("/calendar?event=22")).toEqual({
      ok: true,
      ref: { id: 22, component: "calendar_event", present: "navigate" },
    });
    expect(parseAnimaUri("/note?id=88")).toEqual({
      ok: true,
      ref: { id: 88, component: "note", present: "navigate" },
    });
    expect(parseAnimaUri("/diary?id=5")).toEqual({
      ok: true,
      ref: { id: 5, component: "diary_entry", present: "navigate" },
    });
    expect(parseAnimaUri("/email?account=3")).toEqual({
      ok: true,
      ref: { id: 3, component: "email_account", present: "navigate" },
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
