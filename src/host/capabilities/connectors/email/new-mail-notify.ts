import { getResolvedWorldContext } from "@freeanima/host/core/config";
import { getNotificationPort } from "@freeanima/host/capabilities/tools/notification";
import type { EmailSyncResult } from "@freeanima/features/email/domain";

const MAX_SUBJECTS_IN_BODY = 15;
const MAX_SUBJECT_CHARS = 120;

/** 将自动同步拿到的新邮件标题汇总成一条通知 */
export function buildNewMailNotificationContent(subjects: string[]): {
  title: string;
  body: string;
} {
  const cleaned = subjects.map((s) => s.trim() || "(No subject)");
  const count = cleaned.length;
  if (count === 0) {
    return { title: "新邮件", body: "暂无新邮件" };
  }
  if (count === 1) {
    const only = cleaned[0] ?? "(No subject)";
    const title = `新邮件：${only.slice(0, MAX_SUBJECT_CHARS)}`;
    return { title, body: only };
  }
  const title = `新邮件：${count} 封`;
  const lines = cleaned
    .slice(0, MAX_SUBJECTS_IN_BODY)
    .map((s) => `• ${s.slice(0, MAX_SUBJECT_CHARS)}`);
  if (count > MAX_SUBJECTS_IN_BODY) {
    lines.push(`…另有 ${count - MAX_SUBJECTS_IN_BODY} 封`);
  }
  return { title, body: lines.join("\n") };
}

export function collectNewMailSubjects(results: EmailSyncResult[]): string[] {
  const subjects: string[] = [];
  for (const result of results) {
    subjects.push(...result.new_subjects);
  }
  return subjects;
}

export type NewMailSubjectBucket = {
  kind: "user" | "agent";
  subjects: string[];
};

/** 按账户所属 world 将新信主题分到 user / agent 桶 */
export function bucketNewMailSubjectsByWorld(results: EmailSyncResult[]): NewMailSubjectBucket[] {
  const ctx = getResolvedWorldContext();
  const userSubjects: string[] = [];
  const agentSubjects: string[] = [];
  for (const result of results) {
    if (result.new_subjects.length === 0) continue;
    if (result.world_id === ctx.user_world_id) {
      userSubjects.push(...result.new_subjects);
    } else if (result.world_id === ctx.agent_world_id) {
      agentSubjects.push(...result.new_subjects);
    }
  }
  const out: NewMailSubjectBucket[] = [];
  if (userSubjects.length > 0) out.push({ kind: "user", subjects: userSubjects });
  if (agentSubjects.length > 0) out.push({ kind: "agent", subjects: agentSubjects });
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
    const { title, body } = buildNewMailNotificationContent(bucket.subjects);
    await port.create({
      recipient_kind: recipient.kind,
      recipient_id: recipient.id,
      title,
      body,
      source_kind: "cron",
      source_ref: `email-sync:${bucket.kind}:${now}`,
      payload: { kind: "email_new_mail", count: bucket.subjects.length },
    });
    wrote = true;
  }
  return wrote;
}
