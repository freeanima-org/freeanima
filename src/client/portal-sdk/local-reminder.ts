import { deliverAlert } from "./alert/deliver.ts";
import type { AlertPayload } from "./alert/types.ts";

export type LocalReminderInput = {
  title: string;
  body?: string;
  tag?: string;
  sound?: boolean;
  /** 为 true 时不弹 OS（仍可播音）；伴侣气泡路径忽略此字段 */
  silent?: boolean;
  sourceRoute: string;
};

export type LocalReminderChannel = "companion_bubble" | "alert";

function runtimeWindow(): Window | undefined {
  if (typeof window !== "undefined") return window;
  return (globalThis as { window?: Window }).window;
}

function formatBubbleText(title: string, body?: string): string {
  const t = title.trim();
  const b = body?.trim();
  if (b) return `${t}\n${b}`;
  return t;
}

/**
 * 桌面伴侣可见且可推气泡时优先伴侣通道。
 * 伴侣打开 ≠ 人在旁；仅决定本机通道，不抑制其他端。
 */
export async function isCompanionReminderPreferred(): Promise<boolean> {
  const shell = runtimeWindow()?.portalShell;
  if (!shell?.enqueueCompanionBubble || !shell.getCompanionVisible) return false;
  try {
    return Boolean(await shell.getCompanionVisible());
  } catch {
    return false;
  }
}

/**
 * 本机提醒路由器：companion 可见 → 气泡；否则 / web / mobile → deliverAlert。
 * 同端在源路由 focused 时压制 OS（沿用 AlertContext）。
 */
export async function deliverLocalReminder(
  input: LocalReminderInput,
): Promise<LocalReminderChannel> {
  const preferred = await isCompanionReminderPreferred();
  if (preferred) {
    const shell = runtimeWindow()?.portalShell;
    const text = formatBubbleText(input.title, input.body);
    if (text && shell?.enqueueCompanionBubble) {
      await shell.enqueueCompanionBubble(text);
      return "companion_bubble";
    }
  }

  const payload: AlertPayload = {
    title: input.title,
    ...(input.body != null ? { body: input.body } : {}),
    ...(input.tag != null ? { tag: input.tag } : {}),
    ...(input.sound != null ? { sound: input.sound } : {}),
    ...(input.silent != null ? { silent: input.silent } : {}),
  };
  await deliverAlert(payload, {
    sourceRoute: input.sourceRoute,
    suppressOsWhenFocused: true,
  });
  return "alert";
}
