import { describe, expect, it } from "bun:test";

import { EMAIL_MESSAGE_COMPONENT } from "./components/email-message.ts";
import { entitySearchIndexTextChanged, entitySearchTextForWrite } from "./search-text.ts";

describe("entitySearchTextForWrite", () => {
  it("joins title/summary/content", () => {
    expect(
      entitySearchTextForWrite({
        title: "Hello",
        summary: "preview",
        content: "body",
        body: {},
        primary_component: "task_item",
      }),
    ).toBe("Hello\npreview\nbody");
  });

  it("includes email from/to for email_message", () => {
    expect(
      entitySearchTextForWrite({
        title: "subj",
        summary: "prev",
        content: "hi",
        body: { from: "a@x", to: "b@y", unread: true, flags: ["\\Seen"] },
        primary_component: EMAIL_MESSAGE_COMPONENT,
      }),
    ).toBe("subj\nprev\nhi\na@x\nb@y");
  });
});

describe("entitySearchIndexTextChanged", () => {
  it("ignores email flag/unread-only body changes", () => {
    const base = {
      title: "subj",
      summary: "prev",
      content: "hi",
      primary_component: EMAIL_MESSAGE_COMPONENT,
    };
    expect(
      entitySearchIndexTextChanged(
        { ...base, body: { from: "a@x", to: "b@y", unread: true, flags: [] } },
        { ...base, body: { from: "a@x", to: "b@y", unread: false, flags: ["\\Seen"] } },
      ),
    ).toBe(false);
  });

  it("detects from/to or content changes", () => {
    const base = {
      title: "subj",
      summary: "prev",
      content: "hi",
      primary_component: EMAIL_MESSAGE_COMPONENT,
    };
    expect(
      entitySearchIndexTextChanged(
        { ...base, body: { from: "a@x", to: "b@y" } },
        { ...base, body: { from: "c@x", to: "b@y" } },
      ),
    ).toBe(true);
    expect(
      entitySearchIndexTextChanged(
        { ...base, body: { from: "a@x" } },
        { ...base, content: "hi2", body: { from: "a@x" } },
      ),
    ).toBe(true);
  });

  it("ignores thread aggregate body fields", () => {
    const base = {
      title: "thread",
      summary: "prev",
      content: "",
      primary_component: "email_thread",
    };
    expect(
      entitySearchIndexTextChanged(
        { ...base, body: { unread_count: 1, message_count: 2 } },
        { ...base, body: { unread_count: 0, message_count: 3, last_message_at: "2026-01-01" } },
      ),
    ).toBe(false);
  });
});
