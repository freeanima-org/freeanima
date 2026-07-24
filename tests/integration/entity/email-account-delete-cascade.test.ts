import { afterEach, beforeEach, expect, it } from "bun:test";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { getEntity } from "@freeanima/host/core/db/pg/entity";
import {
  createEmailAccount,
  deleteEmailAccountRow,
  getEmailAccountRow,
  getEmailMessageRow,
  listEmailMessages,
  listEmailThreads,
  upsertEmailMessage,
  upsertEmailThread,
} from "@freeanima/features/email/domain";
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
  });

  afterEach(async () => {
    await endIntegrationCase();
    await restoreIntegrationHome(prev);
  });

  it("deletes local messages, threads, and attachments; leaves no orphans", async () => {
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

    const home = process.env.FREEANIMA_HOME!;
    const attachmentDir = join(home, "email-attachments", String(account.id), String(message.id));
    await mkdir(attachmentDir, { recursive: true });
    await writeFile(join(attachmentDir, "note.txt"), "hi");

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

    await expect(access(join(home, "email-attachments", String(account.id)))).rejects.toThrow();
  });
});
