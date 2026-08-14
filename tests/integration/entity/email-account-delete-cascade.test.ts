import { afterEach, beforeEach, expect, it } from "bun:test";

import { getEntity } from "@freeanima/habitat/core/db/pg/entity";
import {
  createEmailAccount,
  deleteEmailAccountRow,
  getEmailAccountRow,
  getEmailMessageRow,
  listEmailMessages,
  listEmailThreads,
  setEmailMessageAttachments,
  upsertEmailMessage,
  upsertEmailThread,
} from "@freeanima/features/email/domain";
import {
  bindObjectStore,
  createObjectFile,
  createObjectStore,
  getObjectFile,
  resetObjectStoreForTest,
} from "@freeanima/features/object-storage/domain";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { testUserWorldId } from "../../helpers/world-context.ts";

describePg("email account delete cascade", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-email-del-");
    bindObjectStore(createObjectStore({}));
  });

  afterEach(async () => {
    resetObjectStoreForTest();
    await endIntegrationCase();
    await restoreIntegrationHome(prev);
  });

  it("soft-deletes local messages, threads, and attachment object_files", async () => {
    const worldId = testUserWorldId();
    const account = await createEmailAccount(worldId, {
      address: "cascade@test.local",
      password: "secret",
      smtp_host: "smtp.test",
      smtp_port: 587,
      imap_host: "imap.test",
      imap_port: 993,
    });

    const thread = await upsertEmailThread({
      account_id: account.id,
      thread_key: "thread-cascade-1",
      subject: "Hello",
      preview: "preview",
      last_message_at: new Date().toISOString(),
      message_delta: 1,
    });

    const message = await upsertEmailMessage({
      account_id: account.id,
      thread_id: thread.id,
      subject: "Hello",
      preview: "preview",
      body: "body text",
      direction: "inbound",
      from: "someone@example.com",
      to: "cascade@test.local",
      sent_at: new Date().toISOString(),
      imap_uid: 42,
      imap_mailbox: "INBOX",
    });

    const objectFile = await createObjectFile({
      world_id: worldId,
      title: "note.txt",
      bytes: new Uint8Array([1, 2, 3]),
      mime_type: "text/plain",
    });
    await setEmailMessageAttachments(message.id, [
      {
        file_id: `${message.id}-1-abc`,
        filename: "note.txt",
        content_type: "text/plain",
        size: 3,
        object_file_id: objectFile.id,
      },
    ]);

    expect(await listEmailMessages(worldId, { account_id: account.id })).toHaveLength(1);
    expect(await listEmailThreads(worldId, { account_id: account.id })).toHaveLength(1);

    const ok = await deleteEmailAccountRow(worldId, account.id);
    expect(ok).toBe(true);

    expect(await getEmailAccountRow(account.id)).toBeNull();
    expect(await getEntity(account.id)).toBeNull();
    expect(await getEmailMessageRow(message.id)).toBeNull();
    expect(await getEntity(message.id)).toBeNull();
    expect(await getEntity(thread.id)).toBeNull();
    expect(await listEmailMessages(worldId, { account_id: account.id })).toHaveLength(0);
    expect(await listEmailThreads(worldId, { account_id: account.id })).toHaveLength(0);

    // object_file 软删：alive get 为 null，include_deleted 仍可见
    expect(await getObjectFile(objectFile.id)).toBeNull();
    const deleted = await getEntity(objectFile.id, { include_deleted: true });
    expect(deleted?.deleted_at).not.toBeNull();
  });
});
