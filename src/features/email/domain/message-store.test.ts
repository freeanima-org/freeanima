import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";

type Stored = {
  id: number;
  type: string;
  world_id: number;
  components: string[];
  primary_component: string;
  title: string;
  summary: string;
  content: string;
  body: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  tag_ids: number[];
};

const rows = new Map<number, Stored>();
let nextId = 1;

const searchEntities = mock(async (opts: { filters?: Record<string, unknown> }) => {
  const filters = opts.filters ?? {};
  const results = [...rows.values()].filter((row) => {
    const body = row.body;
    if (filters.account_id != null && body.account_id !== filters.account_id) return false;
    if (filters.imap_mailbox != null && body.imap_mailbox !== filters.imap_mailbox) return false;
    if (filters.imap_uid != null && body.imap_uid !== filters.imap_uid) return false;
    if (filters.message_id != null && body.message_id !== filters.message_id) return false;
    return true;
  });
  return { results, total: results.length };
});

const createEntity = mock(
  async (input: {
    type: string;
    world_id: number;
    components: string[];
    primary_component: string;
    title: string;
    summary: string;
    content: string;
    body: Record<string, unknown>;
    tag_ids?: number[];
  }) => {
    const id = nextId;
    nextId += 1;
    const row: Stored = {
      id,
      type: input.type,
      world_id: input.world_id,
      components: input.components,
      primary_component: input.primary_component,
      title: input.title,
      summary: input.summary,
      content: input.content,
      body: { ...input.body },
      created_at: new Date(),
      updated_at: new Date(),
      tag_ids: input.tag_ids ?? [],
    };
    rows.set(id, row);
    return row;
  },
);

const updateEntity = mock(
  async (input: {
    id: number;
    title?: string;
    summary?: string;
    content?: string;
    body?: Record<string, unknown>;
    tag_ids?: number[];
  }) => {
    const existing = rows.get(input.id);
    if (!existing) return null;
    const next: Stored = {
      ...existing,
      title: input.title ?? existing.title,
      summary: input.summary ?? existing.summary,
      content: input.content ?? existing.content,
      body: input.body != null ? { ...existing.body, ...input.body } : { ...existing.body },
      tag_ids: input.tag_ids ?? existing.tag_ids,
      updated_at: new Date(),
    };
    rows.set(input.id, next);
    return next;
  },
);

const getEntity = mock(async (id: number) => rows.get(id) ?? null);
const deleteEntity = mock(async (id: number) => rows.delete(id));

mock.module("@freeanima/host/core/db/pg/entity", () => ({
  searchEntities,
  createEntity,
  updateEntity,
  getEntity,
  deleteEntity,
}));

const emailWorldOriginal = await import("./email-world.ts");
const threadStoreOriginal = await import("./thread-store.ts");
const objectStorageOriginal = await import("@freeanima/features/object-storage/domain");

mock.module("./email-world.ts", () => ({
  ...emailWorldOriginal,
  worldIdForAccount: async () => 1,
  worldIdForThread: async () => 1,
}));

mock.module("./thread-store.ts", () => ({
  ...threadStoreOriginal,
  refreshThreadAggregates: async () => undefined,
}));

// 阻断 object-storage 真依赖（attachment-store 顶层 import）；勿 mock.module attachment-store
// （会污染并行的 attachment-store.test 命名导出）。
mock.module("@freeanima/features/object-storage/domain", () => ({
  ...objectStorageOriginal,
  createObjectFile: async () => {
    throw new Error("createObjectFile not used in message-store unit tests");
  },
  deleteObjectFile: async () => undefined,
  downloadObjectFileBytes: async () => {
    throw new Error("downloadObjectFileBytes not used in message-store unit tests");
  },
}));

afterAll(() => {
  mock.module("./email-world.ts", () => emailWorldOriginal);
  mock.module("./thread-store.ts", () => threadStoreOriginal);
  mock.module("@freeanima/features/object-storage/domain", () => objectStorageOriginal);
});
const { upsertEmailMessage } = await import("./message-store.ts");
const { normalizeRfcMessageId } = await import("./message-id.ts");

function baseInput(partial: {
  imap_mailbox: string;
  imap_uid: number;
  message_id: string;
  subject?: string;
}) {
  return {
    account_id: 10,
    thread_id: 100,
    subject: partial.subject ?? "测试邮件附件",
    preview: "hi",
    body: "body",
    direction: "inbound" as const,
    from: "me@example.com",
    to: "me@example.com",
    sent_at: "2026-08-11T15:00:00+08:00",
    imap_mailbox: partial.imap_mailbox,
    imap_uid: partial.imap_uid,
    message_id: partial.message_id,
  };
}

describe("normalizeRfcMessageId", () => {
  test("adds angle brackets when missing", () => {
    expect(normalizeRfcMessageId("a@b.com")).toBe("<a@b.com>");
    expect(normalizeRfcMessageId("<a@b.com>")).toBe("<a@b.com>");
  });
});

describe("upsertEmailMessage Message-ID dedupe", () => {
  afterEach(() => {
    rows.clear();
    nextId = 1;
    searchEntities.mockClear();
    createEntity.mockClear();
    updateEntity.mockClear();
  });

  test("same mailbox + Message-ID different UID updates one row", async () => {
    const first = await upsertEmailMessage(
      baseInput({
        imap_mailbox: "已发送",
        imap_uid: 5,
        message_id: "<dup@example.com>",
      }),
    );
    const second = await upsertEmailMessage(
      baseInput({
        imap_mailbox: "已发送",
        imap_uid: 4,
        message_id: "dup@example.com",
        subject: "测试邮件附件-updated",
      }),
    );

    expect(second.id).toBe(first.id);
    expect(second.imap_uid).toBe(4);
    expect(second.message_id).toBe("<dup@example.com>");
    expect(createEntity).toHaveBeenCalledTimes(1);
    expect(updateEntity).toHaveBeenCalledTimes(1);
    expect(rows.size).toBe(1);
  });

  test("same Message-ID across mailboxes stays two rows", async () => {
    const sent = await upsertEmailMessage(
      baseInput({
        imap_mailbox: "已发送",
        imap_uid: 5,
        message_id: "<cross@example.com>",
      }),
    );
    const inbox = await upsertEmailMessage(
      baseInput({
        imap_mailbox: "INBOX",
        imap_uid: 3,
        message_id: "<cross@example.com>",
      }),
    );

    expect(inbox.id).not.toBe(sent.id);
    expect(createEntity).toHaveBeenCalledTimes(2);
    expect(rows.size).toBe(2);
  });
});
