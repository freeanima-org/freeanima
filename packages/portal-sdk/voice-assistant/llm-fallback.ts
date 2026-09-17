import { getBundledRpcStreamClient } from "@freeanima/shared/rpc-contract/bundled-rpc-stream-browser.ts";
import { sapCreateConversation } from "@freeanima/shared/rpc-contract/conversation-stream-core.ts";

import { isHabitatFetchAvailable } from "../habitat-fetch-gate.ts";
import { navigateAppModulePath } from "../pomodoro-launch.ts";
import type { VoiceActionResult } from "../voice-actions/execute-intent.ts";
import { readVoiceAssistantPrefs } from "./prefs.ts";

const CONV_KEY = "freeanima.voiceAssistant.conversationId";
const LLM_TIMEOUT_MS = 45_000;

const VOICE_ASSISTANT_PROMPT = `你是移动语音助手。请：
1. 先 toolset_load(["agenda","content"])
2. 根据用户意图创建任务/提醒、写日记等；启动番茄钟无法由工具完成，若用户要番茄请仅回复 ACTION:POMODORO
3. 最后用一句简短中文确认（不超过 30 字）

用户说：`;

function isWifiOnlyBlocked(): boolean {
  const prefs = readVoiceAssistantPrefs();
  if (!prefs.llmFallbackWifiOnly) return false;
  const conn = (navigator as Navigator & { connection?: { type?: string } }).connection;
  if (!conn?.type) return false;
  return conn.type !== "wifi";
}

async function ensureVoiceConversationId(): Promise<string> {
  const stored = localStorage.getItem(CONV_KEY)?.trim();
  if (stored) return stored;

  const stream = getBundledRpcStreamClient();
  const client = await stream.whenReady();
  const created = await sapCreateConversation(client, "chat", "chat", {
    platform: "chat",
    title: "语音助手",
  });
  localStorage.setItem(CONV_KEY, created.conversation_id);
  return created.conversation_id;
}

function summarizeAssistantText(text: string): string {
  const cleaned = text
    .replace(/ACTION:\w+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "已处理";
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}…` : cleaned;
}

/** 快路径无法解析时，单回合 LLM + agenda/content 工具集 */
export async function runVoiceLlmFallback(transcript: string): Promise<VoiceActionResult> {
  if (!isHabitatFetchAvailable()) {
    return { ok: false, message: "离线时无法理解复杂指令" };
  }
  if (isWifiOnlyBlocked()) {
    return { ok: false, message: "未能理解指令，请换个说法试试" };
  }

  const conversationId = await ensureVoiceConversationId();
  const stream = getBundledRpcStreamClient();

  let assistantText = "";
  let pomodoroHint = false;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const timer = window.setTimeout(finish, LLM_TIMEOUT_MS);

    const handle = stream.sendMessageStream(
      {
        conversationId,
        message: `${VOICE_ASSISTANT_PROMPT}「${transcript.trim()}」`,
      },
      {
        onData: (ev) => {
          if (ev.event === "token") {
            assistantText += ev.data.content;
          } else if (ev.event === "content_replace") {
            assistantText = ev.data.content;
          } else if (ev.event === "tool_result" && /pomodoro|番茄/i.test(ev.data.content)) {
            pomodoroHint = true;
          }
        },
        onError: (err) => {
          window.clearTimeout(timer);
          if (!settled) {
            settled = true;
            reject(err);
          }
        },
        onComplete: () => {
          window.clearTimeout(timer);
          finish();
        },
      },
    );

    void handle;
  });

  const text = assistantText.trim();
  if (/ACTION:POMODORO/i.test(text) || pomodoroHint) {
    navigateAppModulePath("/pomodoro?autostart=1");
    return { ok: true, message: "已开始番茄专注" };
  }

  if (text) {
    return { ok: true, message: summarizeAssistantText(text) };
  }

  return { ok: true, message: "已处理" };
}
