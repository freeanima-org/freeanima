import { getTypedHabitatClient } from "../habitat-typed-client.ts";
import { getCachedUserSubjectId } from "../world-context.ts";
import { navigateAppModulePath } from "../pomodoro-launch.ts";
import type { ParsedVoiceIntent } from "../voice-assistant/intent-parser.ts";

export type VoiceActionResult = {
  ok: boolean;
  message: string;
};

async function resolveDefaultListId(subjectId: number): Promise<number | null> {
  const client = getTypedHabitatClient();
  const data = await client.call("tasklist.list", { subject_id: subjectId });
  const lists = data.lists ?? [];
  const def = lists.find((l) => l.is_default);
  if (def) return def.id;
  return lists[0]?.id ?? null;
}

function todayEntryIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T12:00:00.000Z`;
}

export async function executeVoiceIntent(intent: ParsedVoiceIntent): Promise<VoiceActionResult> {
  const subjectId = getCachedUserSubjectId();
  if (subjectId <= 0) {
    return { ok: false, message: "尚未加载用户主体，请稍后重试" };
  }

  const client = getTypedHabitatClient();

  if (intent.kind === "pomodoro") {
    navigateAppModulePath("/pomodoro?autostart=1");
    return { ok: true, message: "已开始番茄专注" };
  }

  if (intent.kind === "task" || intent.kind === "reminder") {
    const listId = await resolveDefaultListId(subjectId);
    if (listId == null) {
      return { ok: false, message: "找不到默认任务清单" };
    }
    await client.call("tasklist.item.create", {
      subject_id: subjectId,
      list_id: listId,
      title: intent.title,
      ...(intent.kind === "reminder" ? { remind_at: intent.remind_at } : {}),
    });
    if (intent.kind === "reminder") {
      return { ok: true, message: `已设置提醒：${intent.title}` };
    }
    return { ok: true, message: `已添加任务：${intent.title}` };
  }

  if (intent.kind === "diary") {
    await client.call("diary.create", {
      subject_id: subjectId,
      title: "语音日记",
      content: intent.content,
      entry_at: todayEntryIso(),
    });
    return { ok: true, message: "已写入日记" };
  }

  return { ok: false, message: "未能理解指令，请换个说法试试" };
}
