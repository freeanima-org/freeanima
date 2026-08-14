import { describe, expect, test } from "bun:test";

import {
  looksLikeRawMime,
  parseEmailMime,
  resolveEmailBodyForRead,
  resolveEmailContentType,
  resolveEmailHeadersForRead,
  looksLikeHtmlContent,
} from "./mime-parse.ts";

function b64(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64");
}

describe("parseEmailMime", () => {
  test("decodes base64 text/plain with charset utf-8", async () => {
    const plain = "你好，灼华。这是一封测试邮件。";
    const raw = [
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "Subject: test",
      "From: a@example.com",
      "To: b@example.com",
      "",
      b64(plain),
    ].join("\r\n");

    const parsed = await parseEmailMime(raw);
    expect(parsed.text).toContain("你好，灼华");
    expect(parsed.content).toContain("你好，灼华");
    expect(parsed.content_type).toBe("text/plain");
    expect(parsed.text).not.toContain(b64(plain));
    expect(looksLikeRawMime(raw)).toBe(true);
  });

  test("multipart/alternative stores html as content raw, text as plain", async () => {
    const boundary = "BOUND123";
    const raw = [
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "Subject: alt",
      "From: a@example.com",
      "To: b@example.com",
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "plain body =E4=B8=AD=E6=96=87",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      "<p>html body</p>",
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const parsed = await parseEmailMime(raw);
    expect(parsed.text).toContain("plain body");
    expect(parsed.text).toContain("中文");
    expect(parsed.text).not.toContain("<p>html body</p>");
    expect(parsed.html).toContain("<p>html body</p>");
    expect(parsed.content).toContain("<p>html body</p>");
    expect(parsed.content_type).toBe("text/html");
  });

  test("falls back to extracted plain when only html part exists", async () => {
    const raw = [
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: 7bit",
      "Subject: html-only",
      "From: a@example.com",
      "To: b@example.com",
      "",
      "<p>only html</p>",
    ].join("\r\n");

    const parsed = await parseEmailMime(raw);
    expect(parsed.text).toContain("only html");
    expect(parsed.html).toContain("<p>only html</p>");
    expect(parsed.content).toContain("<p>only html</p>");
    expect(parsed.content_type).toBe("text/html");
  });
});

describe("resolveEmailBodyForRead", () => {
  test("raw=true returns content raw", async () => {
    const body = await resolveEmailBodyForRead(
      {
        body: "<p>hi</p>",
        content_type: "text/html",
        text: "hi",
      },
      { raw: true },
    );
    expect(body).toBe("<p>hi</p>");
  });

  test("default returns plain text even when content is html", async () => {
    const body = await resolveEmailBodyForRead(
      {
        body: "<p>你好</p>",
        content_type: "text/html",
        text: "你好",
      },
      { raw: false },
    );
    expect(body).toBe("你好");
  });

  test("sniffs html when content_type missing or mislabeled plain", async () => {
    const html = '<div style="border:1px solid #ccc"><p>亲爱的用户</p></div>';
    expect(looksLikeHtmlContent(html)).toBe(true);
    expect(await resolveEmailContentType({ body: html, content_type: "text/plain" })).toBe(
      "text/html",
    );
    const text = await resolveEmailBodyForRead(
      { body: html, content_type: "text/plain", text: null },
      { raw: false },
    );
    expect(text).toContain("亲爱的用户");
    expect(text).not.toContain("<div");
    const raw = await resolveEmailBodyForRead(
      { body: html, content_type: "text/plain", text: null },
      { raw: true },
    );
    expect(raw).toContain("<div");
  });

  test("legacy raw-in-body is decoded on read", async () => {
    const plain = "legacy 中文";
    const raw = [
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "Subject: legacy",
      "",
      b64(plain),
    ].join("\r\n");
    const body = await resolveEmailBodyForRead({ body: raw });
    expect(body).toContain("legacy 中文");
    expect(body).not.toContain("Content-Transfer-Encoding");
  });
});

describe("resolveEmailHeadersForRead", () => {
  test("omits from/to/subject/date and keeps transport headers", async () => {
    const raw = [
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "Subject: keep-out",
      "From: a@example.com",
      "To: b@example.com",
      "Date: Wed, 22 Jul 2026 10:00:00 +0800",
      "Message-ID: <h@example.com>",
      "Received: from mx.example.com",
      "X-Test: headers",
      "",
      "hello",
    ].join("\r\n");
    const headers = await resolveEmailHeadersForRead({ body: "hello", headers: null });
    expect(headers).toEqual({});
    const fromMime = await resolveEmailHeadersForRead({ body: raw });
    expect(fromMime.from).toBeUndefined();
    expect(fromMime.to).toBeUndefined();
    expect(fromMime.subject).toBeUndefined();
    expect(fromMime.date).toBeUndefined();
    expect(fromMime["message-id"]).toContain("<h@example.com>");
    expect(fromMime["x-test"]).toBe("headers");
    expect(fromMime.received).toContain("mx.example.com");
  });
});
