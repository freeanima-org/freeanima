import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ConversationListItem } from "./ConversationListItem.tsx";
import type { ConversationListItem as ConversationListEntry } from "../lib/types.ts";

const baseConversation: ConversationListEntry = {
  id: "c1",
  title: "测试会话",
  created: "2026-01-01T00:00:00.000Z",
  platform: "chat",
};

describe("ConversationListItem", () => {
  it("touch：常驻归档按钮，无 ⋯", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationListItem, {
        conversation: baseConversation,
        label: "测试会话",
        active: false,
        useActionSheet: true,
        contextMenuEnabled: false,
        contextMenuItems: [],
        onNavigate: () => {},
        onOpenMenu: () => {},
        onArchive: () => {},
        onUnarchive: () => {},
      }),
    );
    expect(html).toContain('aria-label="归档"');
    expect(html).not.toContain("⋯");
  });

  it("置顶会话显示图钉标记", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationListItem, {
        conversation: { ...baseConversation, pinnedAt: "2026-01-02T00:00:00.000Z" },
        label: "置顶会话",
        active: false,
        useActionSheet: true,
        contextMenuEnabled: false,
        contextMenuItems: [],
        onNavigate: () => {},
        onOpenMenu: () => {},
        onArchive: () => {},
        onUnarchive: () => {},
      }),
    );
    expect(html).toContain('aria-label="已置顶"');
  });

  it("touch 已归档：取消归档按钮", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationListItem, {
        conversation: { ...baseConversation, archivedAt: "2026-01-02T00:00:00.000Z" },
        label: "已归档会话",
        active: false,
        useActionSheet: true,
        contextMenuEnabled: false,
        contextMenuItems: [],
        onNavigate: () => {},
        onOpenMenu: () => {},
        onArchive: () => {},
        onUnarchive: () => {},
      }),
    );
    expect(html).toContain('aria-label="取消归档"');
  });

  it("pointer 未选中：归档按钮默认隐藏，hover/focus 才露", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationListItem, {
        conversation: baseConversation,
        label: "测试会话",
        active: false,
        useActionSheet: false,
        contextMenuEnabled: true,
        contextMenuItems: [{ label: "归档", onClick: () => {} }],
        onNavigate: () => {},
        onOpenMenu: () => {},
        onArchive: () => {},
        onUnarchive: () => {},
      }),
    );
    expect(html).toContain('aria-label="归档"');
    expect(html).toContain("opacity-0");
    expect(html).toContain("group-hover:opacity-100");
    expect(html).not.toContain("⋯");
  });

  it("pointer 选中：归档按钮可见", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationListItem, {
        conversation: baseConversation,
        label: "测试会话",
        active: true,
        useActionSheet: false,
        contextMenuEnabled: true,
        contextMenuItems: [{ label: "归档", onClick: () => {} }],
        onNavigate: () => {},
        onOpenMenu: () => {},
        onArchive: () => {},
        onUnarchive: () => {},
      }),
    );
    expect(html).toContain('aria-label="归档"');
    expect(html).toContain("opacity-100");
    expect(html).not.toContain("opacity-0");
  });
});
