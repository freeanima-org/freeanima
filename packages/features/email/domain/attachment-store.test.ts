import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  outboundAttachmentMeta,
  persistEmailAttachments,
  resetEmailAttachmentObjectStorageForTest,
  setEmailAttachmentObjectStorageForTest,
  softDeleteEmailAttachmentObjectFiles,
} from "./attachment-store.ts";

const createObjectFile = mock(
  async (input: { world_id: number; title: string; bytes: Uint8Array; mime_type?: string }) => ({
    id: 9000 + input.bytes.byteLength,
    title: input.title,
    world_id: input.world_id,
    cid: "a".repeat(32),
    size: input.bytes.byteLength,
    mime_type: input.mime_type ?? "application/octet-stream",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
);

const deleteObjectFile = mock(async (_id: number) => undefined);

describe("persistEmailAttachments", () => {
  afterEach(() => {
    createObjectFile.mockClear();
    deleteObjectFile.mockClear();
    resetEmailAttachmentObjectStorageForTest();
  });

  test("creates object_file per attachment and returns object_file_id meta", async () => {
    setEmailAttachmentObjectStorageForTest({ createObjectFile });
    const meta = await persistEmailAttachments(5, 20, [
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
    expect(meta[0]?.object_file_id).toBe(9005);
    expect(meta[1]?.filename).toBe(".._.._evil.pdf");
    expect(meta[1]?.object_file_id).toBe(9003);
    expect(createObjectFile).toHaveBeenCalledTimes(2);
    expect(createObjectFile.mock.calls[0]?.[0]?.world_id).toBe(5);
    expect(createObjectFile.mock.calls[0]?.[0]?.title).toBe("note.txt");
  });

  test("softDeleteEmailAttachmentObjectFiles soft-deletes object files", async () => {
    setEmailAttachmentObjectStorageForTest({ deleteObjectFile });
    await softDeleteEmailAttachmentObjectFiles([
      {
        file_id: "1",
        filename: "a.txt",
        content_type: "text/plain",
        size: 1,
        object_file_id: 42,
      },
    ]);
    expect(deleteObjectFile).toHaveBeenCalledWith(42);
  });

  test("outboundAttachmentMeta builds file_id from message id", () => {
    const meta = outboundAttachmentMeta(99, [
      {
        object_file_id: 7,
        filename: "x.pdf",
        content_type: "application/pdf",
        size: 10,
        content: Buffer.from("x"),
      },
    ]);
    expect(meta).toHaveLength(1);
    expect(meta[0]?.object_file_id).toBe(7);
    expect(meta[0]?.filename).toBe("x.pdf");
    expect(meta[0]?.file_id).toContain("99-1-");
  });
});
