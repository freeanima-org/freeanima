import { describe, expect, test } from "bun:test";

import { parseImapHeaderBuffer } from "./imap-client.ts";

describe("parseImapHeaderBuffer", () => {
  test("parses imapflow header Buffer", () => {
    const headers = Buffer.from(
      [
        "Message-ID: <abc@example.com>",
        "In-Reply-To: <parent@example.com>",
        "References: <root@example.com> <parent@example.com>",
      ].join("\r\n"),
    );

    expect(parseImapHeaderBuffer(headers)).toEqual({
      messageId: "<abc@example.com>",
      inReplyTo: "<parent@example.com>",
      references: ["<root@example.com>", "<parent@example.com>"],
    });
  });

  test("returns empty references for missing headers", () => {
    expect(parseImapHeaderBuffer(undefined)).toEqual({ references: [] });
  });
});
