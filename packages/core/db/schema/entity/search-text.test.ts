import { describe, expect, it } from "bun:test";

import { EMAIL_MESSAGE_COMPONENT } from "./components/email-message.ts";
import { VAULT_ITEM_COMPONENT } from "./components/vault-item.ts";
import {
  entitySearchIndexTextChanged,
  entitySearchTextForWrite,
  vaultItemSearchPartsFromBody,
} from "./search-text.ts";

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

  it("includes vault_item url、uris 与 username", () => {
    expect(
      entitySearchTextForWrite({
        title: "GitHub",
        summary: "",
        content: "",
        body: {
          username: "alice",
          url: "https://github.com",
          uris: [
            { uri: "https://github.com", match: "domain" },
            { uri: "https://gist.github.com", match: "host" },
          ],
        },
        primary_component: VAULT_ITEM_COMPONENT,
      }),
    ).toBe("GitHub\nalice\nhttps://github.com\nhttps://gist.github.com");
  });
});

describe("vaultItemSearchPartsFromBody", () => {
  it("跳过与 url 重复的 uri", () => {
    expect(
      vaultItemSearchPartsFromBody({
        url: "https://a.example",
        uris: [{ uri: "https://a.example", match: "domain" }],
      }),
    ).toEqual(["https://a.example"]);
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

  it("detects vault_item url / uri changes", () => {
    const base = {
      title: "Login",
      summary: "",
      content: "",
      primary_component: VAULT_ITEM_COMPONENT,
    };
    expect(
      entitySearchIndexTextChanged(
        { ...base, body: { url: "https://a.example" } },
        { ...base, body: { url: "https://b.example" } },
      ),
    ).toBe(true);
    expect(
      entitySearchIndexTextChanged(
        { ...base, body: { url: "https://a.example" } },
        { ...base, body: { url: "https://a.example", last_used_at: "2026-01-01" } },
      ),
    ).toBe(false);
  });
});
