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
const { EmptyState } = await import("./EmptyState.tsx");
const { StatusAlert } = await import("./StatusAlert.tsx");

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

  it("ConfirmDialog renders modal with default i18n labels", () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmDialog, {
        open: true,
        title: "Delete",
        description: "Sure?",
        variant: "error",
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    expect(html).toContain("modal");
    expect(html).toContain("btn-error");
    expect(html).toContain("Cancel");
    expect(html).toContain("OK");
  });

  it("ActionSheet renders menu items and dismiss", () => {
    let clicked = false;
    const html = renderToStaticMarkup(
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
    );
    expect(html).toContain("modal-bottom");
    expect(html).toContain("Remove");
    expect(html).toContain("Cancel");
    expect(clicked).toBe(false);
  });

  it("EmptyState renders message", () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { message: "No items" }));
    expect(html).toContain("No items");
    expect(html).toContain("text-base-content/60");
  });

  it("StatusAlert applies variant class", () => {
    const html = renderToStaticMarkup(
      createElement(StatusAlert, { variant: "warning", children: "Heads up" }),
    );
    expect(html).toContain("alert-warning");
    expect(html).toContain("Heads up");
  });
});
