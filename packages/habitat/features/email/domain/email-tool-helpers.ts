import { z } from "@freeanima/habitat/core/tool";
import { ensureTagsByTitles } from "@freeanima/features/tag/domain";

import type { listEmailAccountRows } from "./account-store.ts";
import type { getEmailMessageRow } from "./message-store.ts";
import { isMessageFlagged } from "./sync-state.ts";
import {
  applyProviderPreset,
  requireCompleteEmailHosts,
  EMAIL_PROVIDER_IDS,
} from "./provider-presets.ts";

/** 工具层 tags（标题）+ tag_ids → 合并后的 id 列表；未传二者时 undefined。 */
export async function resolveEmailToolTagIds(
  worldId: number,
  input: { tags?: string[]; tag_ids?: number[] },
): Promise<number[] | undefined> {
  if (input.tags === undefined && input.tag_ids === undefined) return undefined;
  const parts: number[][] = [];
  if (input.tag_ids?.length) parts.push(input.tag_ids);
  if (input.tags?.length) parts.push(await ensureTagsByTitles(worldId, input.tags));
  const out: number[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    for (const id of part) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export const emailProviderSchema = z.enum(EMAIL_PROVIDER_IDS);

const accountHostFieldsSchema = z.object({
  provider: emailProviderSchema.optional(),
  smtp_host: z.string().min(1).optional(),
  smtp_port: z.number().int().positive().optional(),
  imap_host: z.string().min(1).optional(),
  imap_port: z.number().int().positive().optional(),
});

export const accountCreateSchema = z
  .object({
    password: z.string().min(1),
    address: z.string().email(),
    display_name: z.string().optional(),
    default_sender: z.boolean().optional(),
    enabled: z.boolean().optional(),
    desc: z.string().optional(),
    tags: z.array(z.string()).optional(),
    tag_ids: z.array(z.number().int().positive()).optional(),
  })
  .merge(accountHostFieldsSchema)
  .transform((raw) => {
    const withPreset = applyProviderPreset(raw);
    const hosts = requireCompleteEmailHosts(withPreset);
    return {
      password: withPreset.password,
      address: withPreset.address,
      smtp_host: hosts.smtp_host,
      smtp_port: hosts.smtp_port,
      imap_host: hosts.imap_host,
      imap_port: hosts.imap_port,
      ...(withPreset.display_name !== undefined ? { display_name: withPreset.display_name } : {}),
      ...(withPreset.default_sender !== undefined
        ? { default_sender: withPreset.default_sender }
        : {}),
      ...(withPreset.enabled !== undefined ? { enabled: withPreset.enabled } : {}),
      ...(withPreset.desc !== undefined ? { desc: withPreset.desc } : {}),
      ...(withPreset.tags !== undefined ? { tags: withPreset.tags } : {}),
      ...(withPreset.tag_ids !== undefined ? { tag_ids: withPreset.tag_ids } : {}),
    };
  });

export const accountPatchSchema = z
  .object({
    password: z.string().min(1).optional(),
    address: z.string().email().optional(),
    display_name: z.string().optional(),
    default_sender: z.boolean().optional(),
    enabled: z.boolean().optional(),
    desc: z.string().optional(),
    tags: z.array(z.string()).optional(),
    tag_ids: z.array(z.number().int().positive()).optional(),
  })
  .merge(accountHostFieldsSchema)
  .transform((raw) => {
    const withPreset = applyProviderPreset(raw);
    const touchesHosts =
      withPreset.provider != null || withPreset.smtp_host != null || withPreset.imap_host != null;
    const hosts = touchesHosts ? requireCompleteEmailHosts(withPreset) : null;
    return {
      ...(withPreset.password !== undefined ? { password: withPreset.password } : {}),
      ...(withPreset.address !== undefined ? { address: withPreset.address } : {}),
      ...(withPreset.display_name !== undefined ? { display_name: withPreset.display_name } : {}),
      ...(hosts
        ? {
            smtp_host: hosts.smtp_host,
            smtp_port: hosts.smtp_port,
            imap_host: hosts.imap_host,
            imap_port: hosts.imap_port,
          }
        : {}),
      ...(withPreset.default_sender !== undefined
        ? { default_sender: withPreset.default_sender }
        : {}),
      ...(withPreset.enabled !== undefined ? { enabled: withPreset.enabled } : {}),
      ...(withPreset.desc !== undefined ? { desc: withPreset.desc } : {}),
      ...(withPreset.tags !== undefined ? { tags: withPreset.tags } : {}),
      ...(withPreset.tag_ids !== undefined ? { tag_ids: withPreset.tag_ids } : {}),
    };
  });

export type EmailToolIo = {
  sendEmail: (input: {
    account_id?: number;
    subject_kind?: "user" | "agent";
    world_id?: number;
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    attachment_object_file_ids?: number[];
  }) => Promise<unknown>;
  markAsRead: (messageId: number) => Promise<unknown>;
  deleteEmail: (messageId: number) => Promise<unknown>;
  assertPasswordResolvable: (account: { password: string }) => Promise<void>;
};

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function accountPayload(account: Awaited<ReturnType<typeof listEmailAccountRows>>[number]) {
  return {
    id: account.id,
    address: account.address,
    display_name: account.display_name,
    smtp_host: account.smtp_host,
    smtp_port: account.smtp_port,
    imap_host: account.imap_host,
    imap_port: account.imap_port,
    default_sender: account.default_sender,
    enabled: account.enabled,
    desc: account.desc,
    tag_ids: account.tag_ids,
    password: account.password,
    sync: account.sync,
    created_at: account.created_at,
    updated_at: account.updated_at,
  };
}

export type MessagePayloadOpts = {
  /** true：返回正文 content raw（html 或 plain）；默认返回纯文本 */
  raw?: boolean;
  /** 是否附带 headers 字段 */
  includeHeaders?: boolean;
  /** 是否附带 attachments 元信息 */
  includeAttachments?: boolean;
};

export async function messagePayload(
  message: NonNullable<Awaited<ReturnType<typeof getEmailMessageRow>>>,
  opts: MessagePayloadOpts = {},
) {
  const { resolveEmailBodyForRead, resolveEmailHeadersForRead, resolveEmailContentType } =
    await import("./mime-parse.ts");
  const body = await resolveEmailBodyForRead(message, { raw: opts.raw === true });
  const content_type = await resolveEmailContentType(message);
  const includeHeaders = opts.includeHeaders === true;
  const includeAttachments = opts.includeAttachments === true;
  return {
    id: message.id,
    account_id: message.account_id,
    thread_id: message.thread_id,
    subject: message.subject,
    preview: message.preview,
    body,
    content_type,
    from: message.from,
    to: message.to,
    cc: message.cc,
    sent_at: message.sent_at,
    unread: message.unread,
    flagged: isMessageFlagged(message.flags ?? []),
    direction: message.direction,
    imap_uid: message.imap_uid,
    tag_ids: message.tag_ids,
    ...(includeHeaders ? { headers: await resolveEmailHeadersForRead(message) } : {}),
    ...(includeAttachments
      ? {
          attachments: (message.attachments ?? []).map((a) => ({
            file_id: a.file_id,
            filename: a.filename,
            content_type: a.content_type,
            size: a.size,
            object_file_id: a.object_file_id,
            entity_id: message.id,
            ...(a.content_id ? { content_id: a.content_id } : {}),
          })),
        }
      : {}),
  };
}

export function parseAccountId(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

export function parseMessageId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}
