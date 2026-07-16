import { describe, expect, it } from "bun:test";

import type { ShellNavItem } from "./shell-nav-i18n.ts";
import {
  layoutShellBottomNav,
  layoutShellBottomNavItems,
  SHELL_BOTTOM_NAV_MIN_ICON_PER_ITEM_PX,
  SHELL_BOTTOM_NAV_MIN_LABEL_PER_ITEM_PX,
} from "./shell-bottom-nav-layout.ts";

function mockItem(id: string, label: string): ShellNavItem {
  return {
    id: id as ShellNavItem["id"],
    to: `/${id}`,
    match: `/${id}`,
    label: () => label,
    icon: (() => null) as ShellNavItem["icon"],
  };
}

const sampleItems = [
  mockItem("chat", "聊天室"),
  mockItem("tasks", "任务"),
  mockItem("email", "邮件"),
  mockItem("diary", "日记"),
  mockItem("dream", "梦境"),
  mockItem("notifications", "通知"),
  mockItem("vault", "Vault"),
  mockItem("console", "仪表盘"),
  mockItem("settings", "设置"),
];

const elevenItems = [
  mockItem("chat", "聊天室"),
  mockItem("tasks", "任务"),
  mockItem("projects", "Projects"),
  mockItem("pomodoro", "Pomodoro"),
  mockItem("email", "邮件"),
  mockItem("diary", "日记"),
  mockItem("vault", "Vault"),
  mockItem("dream", "梦境"),
  mockItem("notifications", "通知"),
  mockItem("console", "仪表盘"),
  mockItem("settings", "设置"),
];

describe("layoutShellBottomNavItems", () => {
  it("无模块时返回空", () => {
    expect(layoutShellBottomNavItems([], 400)).toEqual({
      bar: [],
      more: [],
      density: "label",
    });
  });

  it("宽屏少量模块全部满铺带文案", () => {
    const items = sampleItems.slice(0, 5);
    const result = layoutShellBottomNavItems(items, 520);
    expect(result.bar).toEqual(items);
    expect(result.more).toEqual([]);
    expect(result.density).toBe("label");
  });

  it("截图类场景 390px + 11 项满铺仅图标", () => {
    const result = layoutShellBottomNavItems(elevenItems, 390);
    expect(result.bar).toHaveLength(11);
    expect(result.more).toEqual([]);
    expect(result.density).toBe("icon");
    expect(390 / elevenItems.length).toBeGreaterThanOrEqual(SHELL_BOTTOM_NAV_MIN_ICON_PER_ITEM_PX);
  });

  it("430px + 11 项满铺带文案", () => {
    const result = layoutShellBottomNavItems(elevenItems, 528);
    expect(result.bar).toHaveLength(11);
    expect(result.more).toEqual([]);
    expect(result.density).toBe("label");
    expect(528 / elevenItems.length).toBeGreaterThanOrEqual(SHELL_BOTTOM_NAV_MIN_LABEL_PER_ITEM_PX);
  });

  it("320px + 11 项 More 兜底且 bar 数大于 3", () => {
    const result = layoutShellBottomNavItems(elevenItems, 320);
    expect(result.more.length).toBeGreaterThan(0);
    expect(result.bar.length).toBeGreaterThan(3);
    expect(result.bar.length + result.more.length).toBe(11);
  });

  it("极窄屏 More 兜底保留至少 1 个 bar 项", () => {
    const result = layoutShellBottomNavItems(elevenItems, 200);
    expect(result.more.length).toBeGreaterThan(0);
    expect(result.bar.length).toBeGreaterThanOrEqual(1);
    expect(result.bar.length + result.more.length).toBe(11);
  });
});

describe("layoutShellBottomNav", () => {
  it("中等宽度 9 项样本尽量满铺", () => {
    const { bar, more } = layoutShellBottomNav(sampleItems, 400);
    expect(bar.length + more.length).toBe(sampleItems.length);
    if (400 / sampleItems.length >= SHELL_BOTTOM_NAV_MIN_LABEL_PER_ITEM_PX) {
      expect(more).toEqual([]);
    }
  });
});
