import { describe, expect, it } from "bun:test";

import type { ShellNavItem } from "./shell-nav-i18n.ts";
import {
  layoutShellBottomNav,
  resolveShellBottomNavCapacity,
  splitShellBottomNavItems,
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

describe("resolveShellBottomNavCapacity", () => {
  it("窄屏容量较少", () => {
    expect(resolveShellBottomNavCapacity(320, sampleItems)).toBe(4);
  });

  it("宽屏容量增加", () => {
    expect(resolveShellBottomNavCapacity(430, sampleItems)).toBeGreaterThanOrEqual(5);
  });
});

describe("splitShellBottomNavItems", () => {
  it("实际数量不超过容量时全部展示且不需要 More", () => {
    const items = sampleItems.slice(0, 4);
    expect(splitShellBottomNavItems(items, 5)).toEqual({ bar: items, more: [] });
  });

  it("超出容量时预留 More 槽位", () => {
    const items = sampleItems.slice(0, 6);
    const { bar, more } = splitShellBottomNavItems(items, 5);
    expect(bar).toHaveLength(4);
    expect(more).toHaveLength(2);
  });
});

describe("layoutShellBottomNav", () => {
  it("宽屏可放下全部可见模块时不出现 More", () => {
    const items = sampleItems.slice(0, 5);
    const { bar, more } = layoutShellBottomNav(items, 520);
    expect(bar).toEqual(items);
    expect(more).toEqual([]);
  });

  it("窄屏将溢出项收入 More", () => {
    const { bar, more } = layoutShellBottomNav(sampleItems, 320);
    expect(bar.length + more.length).toBe(sampleItems.length);
    expect(more.length).toBeGreaterThan(0);
  });
});
