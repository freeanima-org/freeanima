import { getResolvedWorldContext } from "@freeanima/host/core/config";
import { getNotificationPort } from "@freeanima/host/capabilities/tools/notification";
import type { EmailSyncResult, NewMailNotifyItem } from "@freeanima/features/email/domain";

const MAX_MAILS_IN_BODY = 15;
const MAX_SUBJECT_CHARS = 120;

function normalizeMail(item: NewMailNotifyItem): NewMailNotifyItem {
  return {
    message_id: item.message_id,
    from: item.from.trim() || "(unknown)",
    subject: item.subject.trim() || "(No subject)",
  };
}

function formatSingleBody(mail: NewMailNotifyItem): string {
  return [
    `from: ${mail.from}`,
    `message_id: ${mail.message_id}`,
    `subject: ${mail.subject.slice(0, MAX_SUBJECT_CHARS)}`,
  ].join("\n");
}

function formatMultiLine(mail: NewMailNotifyItem): string {
  return `• from: ${mail.from} | message_id: ${mail.message_id} | subject: ${mail.subject.slice(0, MAX_SUBJECT_CHARS)}`;
}

/** 将自动同步拿到的新邮件汇总成一条通知 */
export function buildNewMailNotificationContent(mails: NewMailNotifyItem[]): {
  title: string;
  body: string;
} {
  const cleaned = mails.map(normalizeMail);
  const count = cleaned.length;
  if (count === 0) {
    return { title: "新邮件", body: "暂无新邮件" };
  }
  if (count === 1) {
    const only = cleaned[0];
    if (!only) {
      return { title: "新邮件", body: "暂无新邮件" };
    }
    const title = `新邮件：${only.subject.slice(0, MAX_SUBJECT_CHARS)}`;
    return { title, body: formatSingleBody(only) };
  }
  const title = `新邮件：${count} 封`;
  const lines = cleaned.slice(0, MAX_MAILS_IN_BODY).map(formatMultiLine);
  if (count > MAX_MAILS_IN_BODY) {
    lines.push(`…另有 ${count - MAX_MAILS_IN_BODY} 封`);
  }
  return { title, body: lines.join("\n") };
}

export function collectNewMails(results: EmailSyncResult[]): NewMailNotifyItem[] {
  const mails: NewMailNotifyItem[] = [];
  for (const result of results) {
    mails.push(...result.new_mails);
  }
  return mails;
}

export type NewMailSubjectBucket = {
  kind: "user" | "agent";
  mails: NewMailNotifyItem[];
};

/** 按账户所属 world 将新信分到 user / agent 桶 */
export function bucketNewMailSubjectsByWorld(results: EmailSyncResult[]): NewMailSubjectBucket[] {
  const ctx = getResolvedWorldContext();
  const userMails: NewMailNotifyItem[] = [];
  const agentMails: NewMailNotifyItem[] = [];
  for (const result of results) {
    if (result.new_mails.length === 0) continue;
    if (result.world_id === ctx.user_world_id) {
      userMails.push(...result.new_mails);
    } else if (result.world_id === ctx.agent_world_id) {
      agentMails.push(...result.new_mails);
    }
  }
  const out: NewMailSubjectBucket[] = [];
  if (userMails.length > 0) out.push({ kind: "user", mails: userMails });
  if (agentMails.length > 0) out.push({ kind: "agent", mails: agentMails });
  return out;
}

/** 按账户 world 写入对应 subject 收件箱（手动同步勿调用） */
export async function notifyNewMailFromSyncResults(results: EmailSyncResult[]): Promise<boolean> {
  const buckets = bucketNewMailSubjectsByWorld(results);
  if (buckets.length === 0) return false;
  const port = getNotificationPort();
  if (!port) return false;

  const now = Date.now();
  let wrote = false;
  for (const bucket of buckets) {
    const recipient = bucket.kind === "user" ? port.getUserRecipient() : port.getAgentRecipient();
    const { title, body } = buildNewMailNotificationContent(bucket.mails);
    await port.create({
      recipient_kind: recipient.kind,
      recipient_id: recipient.id,
      title,
      body,
      source_kind: "cron",
      source_ref: `email-sync:${bucket.kind}:${now}`,
      payload: {
        kind: "email_new_mail",
        count: bucket.mails.length,
        messages: bucket.mails.map((m) => ({ message_id: m.message_id, from: m.from })),
      },
    });
    wrote = true;
  }
  return wrote;
}
