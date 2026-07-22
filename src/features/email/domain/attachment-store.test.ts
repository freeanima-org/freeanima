import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { persistEmailAttachments } from "./attachment-store.ts";

describe("persistEmailAttachments", () => {
  let home: string | undefined;
  const prevHome = process.env.FREEANIMA_HOME;

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
    if (home) await rm(home, { recursive: true, force: true });
    home = undefined;
  });

  test("writes files under FREEANIMA_HOME/email-attachments and returns meta", async () => {
    home = await mkdtemp(join(tmpdir(), "anima-email-att-"));
    process.env.FREEANIMA_HOME = home;

    const meta = await persistEmailAttachments(10, 20, [
      {
        filename: "note.txt",
        content_type: "text/plain",
        size: 5,
        content: Buffer.from("hello"),
      },
      {
        filename: "../../evil.pdf",
        content_type: "application/pdf",
        size: 3,
        content: Buffer.from("pdf"),
      },
    ]);

    expect(meta).toHaveLength(2);
    expect(meta[0]?.filename).toBe("note.txt");
    expect(meta[0]?.file_id).toContain("20-1-");
    expect(meta[0]?.path).toContain(join("email-attachments", "10", "20"));
    expect(meta[1]?.filename).toBe(".._.._evil.pdf");
    expect(await readFile(meta[0]!.path, "utf8")).toBe("hello");
    expect(await readFile(meta[1]!.path)).toEqual(Buffer.from("pdf"));
  });
});
