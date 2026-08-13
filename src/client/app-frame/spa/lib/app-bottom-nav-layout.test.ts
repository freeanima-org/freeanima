import { describe, expect, it } from "bun:test";

import type { AppNavItem } from "./app-nav-i18n.ts";
import {
  layoutAppBottomNav,
  layoutAppBottomNavItems,
  APP_BOTTOM_NAV_MIN_ICON_PER_ITEM_PX,
  APP_BOTTOM_NAV_MIN_LABEL_PER_ITEM_PX,
} from "./app-bottom-nav-layout.ts";

function mockItem(id: string, label: string): AppNavItem {
  return {
    id: id as AppNavItem["id"],
    to: `/${id}`,
    match: `/${id}`,
    label: () => label,
    icon: () => null,
  };
}

const sampleItems = [
  mockItem("chat", "聊天室"),
  mockItem("tasks", "任务"),
  mockItem("email", "邮件"),
  mockItem("diary", "日记"),
  mockItem("notifications", "通知"),
  mockItem("vault", "Vault"),
  mockItem("habitat", "仪表盘"),
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
  mockItem("notifications", "通知"),
  mockItem("habitat", "仪表盘"),
  mockItem("settings", "设置"),
  mockItem("pomodoro", "番茄钟2"),
];

describe("layoutAppBottomNavItems", () => {
  it("无模块时返回空", () => {
    expect(layoutAppBottomNavItems([], 400)).toEqual({
      bar: [],
      more: [],
      density: "label",
    });
  });

  it("宽屏少量模块全部满铺带文案", () => {
    const items = sampleItems.slice(0, 5);
    const result = layoutAppBottomNavItems(items, 520);
    expect(result.bar).toEqual(items);
    expect(result.more).toEqual([]);
    expect(result.density).toBe("label");
  });

  it("截图类场景 390px + 11 项满铺仅图标", () => {
    const result = layoutAppBottomNavItems(elevenItems, 390);
    expect(result.bar).toHaveLength(11);
    expect(result.more).toEqual([]);
    expect(result.density).toBe("icon");
    expect(390 / elevenItems.length).toBeGreaterThanOrEqual(APP_BOTTOM_NAV_MIN_ICON_PER_ITEM_PX);
  });

  it("430px + 11 项满铺带文案", () => {
    const result = layoutAppBottomNavItems(elevenItems, 528);
    expect(result.bar).toHaveLength(11);
    expect(result.more).toEqual([]);
    expect(result.density).toBe("label");
    expect(528 / elevenItems.length).toBeGreaterThanOrEqual(APP_BOTTOM_NAV_MIN_LABEL_PER_ITEM_PX);
  });

  it("320px + 11 项 More 兜底且 bar 数大于 3", () => {
    const result = layoutAppBottomNavItems(elevenItems, 320);
    expect(result.more.length).toBeGreaterThan(0);
    expect(result.bar.length).toBeGreaterThan(3);
    expect(result.bar.length + result.more.length).toBe(11);
  });

  it("极窄屏 More 兜底保留至少 1 个 bar 项", () => {
    const result = layoutAppBottomNavItems(elevenItems, 200);
    expect(result.more.length).toBeGreaterThan(0);
    expect(result.bar.length).toBeGreaterThanOrEqual(1);
    expect(result.bar.length + result.more.length).toBe(11);
  });
});

describe("layoutAppBottomNav", () => {
  it("中等宽度 9 项样本尽量满铺", () => {
    const { bar, more } = layoutAppBottomNav(sampleItems, 400);
    expect(bar.length + more.length).toBe(sampleItems.length);
    if (400 / sampleItems.length >= APP_BOTTOM_NAV_MIN_LABEL_PER_ITEM_PX) {
      expect(more).toEqual([]);
    }
  });
});
