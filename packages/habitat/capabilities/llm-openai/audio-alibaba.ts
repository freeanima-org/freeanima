import { WebSocket, type RawData } from "ws";

import { randomPublicId } from "@freeanima/shared/util";

/** OpenAI 兼容根 → DashScope 音频推理 WebSocket */
export function alibabaAudioWsUrl(openaiCompatibleBaseUrl: string): string {
  const trimmed = openaiCompatibleBaseUrl.trim().replace(/\/$/, "");
  let host: string;
  try {
    host = new URL(trimmed).host;
  } catch {
    throw new Error(`无效的 Base URL: ${openaiCompatibleBaseUrl}`);
  }
  if (!host) throw new Error(`无效的 Base URL: ${openaiCompatibleBaseUrl}`);
  return `wss://${host}/api-ws/v1/inference`;
}

export type AlibabaTtsSynthesizeInput = {
  apiKey: string;
  baseUrl: string;
  model: string;
  text: string;
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  format?: "mp3" | "wav" | "pcm";
  sampleRate?: number;
  timeoutMs?: number;
};

export type AlibabaTtsSynthesizeResult = {
  bytes: Uint8Array;
  mimeType: string;
};

function mimeForFormat(format: string): string {
  if (format === "wav") return "audio/wav";
  if (format === "pcm") return "audio/pcm";
  return "audio/mpeg";
}

function wsRawDataToBuffers(raw: RawData): Buffer[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((part) => wsRawDataToBuffers(part as RawData));
  }
  if (Buffer.isBuffer(raw)) return [raw];
  if (raw instanceof ArrayBuffer) return [Buffer.from(raw)];
  if (typeof raw === "string") return [Buffer.from(raw, "utf8")];
  const view = raw as ArrayBufferView;
  return [Buffer.from(view.buffer, view.byteOffset, view.byteLength)];
}

/**
 * 阿里云 Token Plan / 百炼 SpeechSynthesizer（WebSocket）。
 * 实时对话模型请用 realtime 客户端，勿走本函数。
 */
export async function synthesizeAlibabaTts(
  input: AlibabaTtsSynthesizeInput,
): Promise<AlibabaTtsSynthesizeResult> {
  const text = input.text.replace(/\s+/g, " ").trim();
  if (!text) throw new Error("合成文本不能为空");
  if (/realtime/i.test(input.model)) {
    throw new Error("实时语音对话模型请使用实时子场景，不能作为批量文生声");
  }

  const wsUrl = alibabaAudioWsUrl(input.baseUrl);
  const format = input.format ?? "mp3";
  const timeoutMs = input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : 120_000;
  const taskId = randomPublicId();
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(err);
    };
    const ok = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve();
    };

    const timer = setTimeout(() => fail(new Error("阿里云语音合成超时")), timeoutMs);

    const ws = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
      },
    });

    ws.on("error", (err) => fail(err instanceof Error ? err : new Error(String(err))));

    ws.on("open", () => {
      const runTask = {
        header: {
          action: "run-task",
          task_id: taskId,
          streaming: "duplex",
        },
        payload: {
          task_group: "audio",
          task: "tts",
          function: "SpeechSynthesizer",
          model: input.model,
          parameters: {
            text_type: "PlainText",
            ...(input.voice?.trim() ? { voice: input.voice.trim() } : {}),
            format,
            sample_rate: input.sampleRate ?? 22050,
            ...(input.volume != null ? { volume: input.volume } : {}),
            ...(input.rate != null ? { rate: input.rate } : {}),
            ...(input.pitch != null ? { pitch: input.pitch } : {}),
          },
          input: {},
        },
      };
      ws.send(JSON.stringify(runTask));
    });

    ws.on("message", (data, isBinary) => {
      const frames = wsRawDataToBuffers(data);
      for (const buf of frames) {
        const looksJson = buf.length > 0 && buf[0] === 0x7b; /* '{' */
        if (isBinary || !looksJson) {
          if (buf.length > 0 && !looksJson) {
            chunks.push(buf);
            continue;
          }
        }
        try {
          const parsed = JSON.parse(buf.toString("utf8")) as {
            header?: { event?: string; error_message?: string; error_code?: string };
          };
          const event = parsed.header?.event;
          if (event === "task-started") {
            ws.send(
              JSON.stringify({
                header: {
                  action: "continue-task",
                  task_id: taskId,
                  streaming: "duplex",
                },
                payload: { input: { text } },
              }),
            );
            ws.send(
              JSON.stringify({
                header: {
                  action: "finish-task",
                  task_id: taskId,
                  streaming: "duplex",
                },
                payload: { input: {} },
              }),
            );
            continue;
          }
          if (event === "result-generated") {
            continue;
          }
          if (event === "task-finished") {
            ok();
            continue;
          }
          if (event === "task-failed") {
            fail(
              new Error(
                parsed.header?.error_message || parsed.header?.error_code || "阿里云语音合成失败",
              ),
            );
          }
        } catch {
          if (buf.length > 0) chunks.push(buf);
        }
      }
    });

    ws.on("close", () => {
      if (!settled) {
        if (chunks.length > 0) ok();
        else fail(new Error("阿里云语音合成连接已关闭"));
      }
    });
  });

  const bytes = new Uint8Array(Buffer.concat(chunks));
  if (bytes.byteLength === 0) {
    throw new Error("阿里云语音合成未返回音频数据");
  }
  return { bytes, mimeType: mimeForFormat(format) };
}

/**
 * 实时语音对话客户端骨架：本轮仅校验模型并给出明确错误，避免误当批量 TTS。
 */
export function assertAlibabaRealtimeModelReady(model: string): never {
  throw new Error(
    `实时语音对话模型「${model}」的双工会话能力尚未接入产品面；请改用语音合成模型（如 qwen-audio-3.0-tts-plus）或等待后续实时子场景`,
  );
}
