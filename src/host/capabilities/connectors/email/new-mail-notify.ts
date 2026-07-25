import { getNotificationPort } from "@freeanima/host/capabilities/tools/notification";
import type { EmailSyncResult } from "@freeanima/features/email/domain";

const MAX_SUBJECTS_IN_BODY = 15;
const MAX_SUBJECT_CHARS = 120;

/** 将自动同步拿到的新邮件标题汇总成一条用户通知 */
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

/** 向用户收件箱写入新邮件汇总通知（手动同步勿调用） */
export async function notifyNewMailSubjects(subjects: string[]): Promise<boolean> {
  if (subjects.length === 0) return false;
  const port = getNotificationPort();
  if (!port) return false;
  const user = port.getUserRecipient();
  const { title, body } = buildNewMailNotificationContent(subjects);
  await port.create({
    recipient_kind: user.kind,
    recipient_id: user.id,
    title,
    body,
    source_kind: "cron",
    source_ref: `email-sync:${Date.now()}`,
    payload: { kind: "email_new_mail", count: subjects.length },
  });
  return true;
}
