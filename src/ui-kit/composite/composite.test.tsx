import { describe, expect, it, mock } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("@paraglide/messages", () => ({
  m: {
    ui_common_cancel: () => "Cancel",
    ui_common_confirm: () => "OK",
  },
}));

const { ConfirmDialog } = await import("./ConfirmDialog.tsx");
const { ActionSheet } = await import("./ActionSheet.tsx");
const { ContextMenu } = await import("./ContextMenu.tsx");
const { EmptyState } = await import("./EmptyState.tsx");
const { StatusAlert } = await import("./StatusAlert.tsx");
const { TaskItemTagStrip } = await import("./TaskItemTagStrip.tsx");

describe("composite components", () => {
  it("ConfirmDialog renders nothing when closed", () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmDialog, {
        open: false,
        title: "Delete",
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    expect(html).toBe("");
  });

  it("ConfirmDialog mounts when open (Radix Dialog 内容走 Portal，SSR 不输出 DOM)", () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(ConfirmDialog, {
          open: true,
          title: "Delete",
          description: "Sure?",
          variant: "error",
          onConfirm: () => {},
          onCancel: () => {},
        }),
      ),
    ).not.toThrow();
  });

  it("ActionSheet mounts with items (Radix Sheet 内容走 Portal，SSR 不输出 DOM)", () => {
    let clicked = false;
    expect(() =>
      renderToStaticMarkup(
        createElement(ActionSheet, {
          title: "Actions",
          items: [
            {
              label: "Remove",
              danger: true,
              onClick: () => {
                clicked = true;
              },
            },
          ],
          onClose: () => {},
        }),
      ),
    ).not.toThrow();
    expect(clicked).toBe(false);
  });

  it("ContextMenu with empty items renders children only", () => {
    const html = renderToStaticMarkup(
      createElement(ContextMenu, {
        items: [],
        children: createElement("button", { type: "button" }, "Row"),
      }),
    );
    expect(html).toContain("Row");
  });

  it("ContextMenu mounts with items (Radix Content 走 Portal)", () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(ContextMenu, {
          items: [{ label: "Edit", onClick: () => {} }],
          children: createElement("button", { type: "button" }, "Row"),
        }),
      ),
    ).not.toThrow();
  });

  it("EmptyState renders message", () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { message: "No items" }));
    expect(html).toContain("No items");
    expect(html).toContain("text-muted-foreground");
  });

  it("StatusAlert applies variant class", () => {
    const html = renderToStaticMarkup(
      createElement(StatusAlert, { variant: "warning", children: "Heads up" }),
    );
    expect(html).toContain("Heads up");
    expect(html).toContain('role="alert"');
  });

  it("TaskItemTagStrip renders overflow +N", () => {
    const html = renderToStaticMarkup(
      createElement(TaskItemTagStrip, { titles: ["alpha", "beta", "gamma"] }),
    );
    expect(html).toContain("alpha");
    expect(html).toContain("beta");
    expect(html).toContain("+1");
    expect(html).toContain("overflow-hidden");
    // 溢出标签仅出现在 title/aria-label，不作为第三个 chip
    expect(html).toContain('title="alpha、beta、gamma"');
    expect(html.match(/>gamma</g) ?? []).toHaveLength(0);
  });
});
