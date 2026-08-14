import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  deleteChatAttachmentTemp,
  putChatAttachmentTemp,
  readChatAttachmentTempBytes,
  resolveAttachmentMetasFromTemps,
} from "./attachment-temp.ts";

describe("chat attachment temp", () => {
  const prevHome = process.env.FREEANIMA_HOME;
  let home = "";

  beforeAll(() => {
    home = mkdtempSync(join(tmpdir(), "anima-chat-att-"));
    process.env.FREEANIMA_HOME = home;
  });

  afterAll(() => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
    if (home) {
      try {
        rmSync(home, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  it("put/get/delete roundtrip", () => {
    const bytes = new TextEncoder().encode("hello");
    const rec = putChatAttachmentTemp({
      filename: "a.txt",
      mime_type: "text/plain",
      bytes,
    });
    expect(rec.size).toBe(5);
    const read = readChatAttachmentTempBytes(rec.temp_id);
    expect(read ? new TextDecoder().decode(read) : null).toBe("hello");
    expect(resolveAttachmentMetasFromTemps([rec.temp_id])[0]?.filename).toBe("a.txt");
    deleteChatAttachmentTemp(rec.temp_id);
    expect(readChatAttachmentTempBytes(rec.temp_id)).toBeNull();
  });
});
