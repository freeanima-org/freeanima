import { fetchWorldContext, getSubjectKind, resolveWorldIdForSubject } from "@freeanima/shell-sdk";

import { whenSapClientReady } from "./sap-client.ts";

export type EmailAccountRow = {
  id: number;
  display_name: string;
  address: string;
  default_sender: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type EmailMessageRow = {
  id: number;
  account_id: number;
  thread_id: number;
  subject: string;
  preview: string;
  body: string;
  from: string;
  to: string;
  sent_at: string;
  unread: boolean;
  direction: "inbound" | "outbound";
  tags: string[];
};

async function sap() {
  return whenSapClientReady();
}

function withSubjectKind<T extends Record<string, unknown>>(payload: T) {
  return { subject_kind: getSubjectKind(), ...payload };
}

export async function fetchEmailAccounts(): Promise<EmailAccountRow[]> {
  const client = await sap();
  const data = await client.request("emailaccount.list", withSubjectKind({}));
  return data.accounts;
}

export async function fetchEmailMessages(input: {
  account_id?: number;
  thread_id?: number;
  unread?: boolean;
  limit?: number;
}): Promise<EmailMessageRow[]> {
  const client = await sap();
  const data = await client.request("email.message.list", withSubjectKind(input));
  return data.messages;
}

export async function readEmailMessage(id: number): Promise<EmailMessageRow> {
  const client = await sap();
  const data = await client.request("email.message.read", withSubjectKind({ id }));
  return data.message;
}

export async function markEmailMessageRead(id: number): Promise<void> {
  const client = await sap();
  await client.request("email.message.markRead", withSubjectKind({ id }));
}

export type EmailSyncResult = {
  account_id: number;
  upserted_messages: number;
  upserted_threads: number;
  highest_uid: number | null;
  error?: string;
};

export async function syncEmailAccount(
  accountId?: number,
  limit = 100,
): Promise<EmailSyncResult[]> {
  const client = await sap();
  const data = await client.request(
    "email.sync",
    withSubjectKind({ account_id: accountId, limit }),
  );
  const results = data.results;
  const failed = results.filter((row) => row.error);
  if (failed.length > 0) {
    throw new Error(failed.map((row) => row.error).join("; "));
  }
  return results;
}

export async function searchEmailMessages(input: {
  query: string;
  account_id?: number;
  limit?: number;
}): Promise<EmailMessageRow[]> {
  const ctx = await fetchWorldContext();
  const world_id = resolveWorldIdForSubject(ctx, getSubjectKind());
  const res = await fetch("/api/entities/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: input.query,
      world_id,
      primary_component: "email_message",
      mode: "hybrid",
      filters: input.account_id != null ? { account_id: input.account_id } : undefined,
      limit: input.limit ?? 30,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `search failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    results: Array<{
      id: number;
      title: string;
      summary?: string;
      content?: string;
      body?: Record<string, unknown>;
      created_at?: string;
      updated_at?: string;
    }>;
  };
  return data.results.map((row) => ({
    id: row.id,
    account_id: Number(row.body?.account_id ?? 0),
    thread_id: Number(row.body?.thread_id ?? 0),
    subject: row.title,
    preview: row.summary ?? "",
    body: row.content ?? "",
    from: String(row.body?.from ?? ""),
    to: String(row.body?.to ?? ""),
    sent_at: String(row.body?.sent_at ?? row.created_at ?? ""),
    unread: Boolean(row.body?.unread),
    direction: (row.body?.direction as EmailMessageRow["direction"]) ?? "inbound",
    tags: Array.isArray(row.body?.tags) ? row.body.tags.map(String) : [],
  }));
}
