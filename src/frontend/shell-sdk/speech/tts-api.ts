import { MAX_HUB_TTS_TEXT_LENGTH } from "./constants.ts";
import { resolveHubApiFetch, resolveHubApiUrl } from "../hub-api-fetch.ts";

export type HubTtsSynthesizeParams = {
  text: string;
  lang?: string | null;
  voice?: string | null;
  appLocale: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};

export async function synthesizeSpeechViaHub(params: HubTtsSynthesizeParams): Promise<ArrayBuffer> {
  const text = params.text.replace(/\s+/g, " ").trim();
  if (!text) {
    throw new Error("朗读文本不能为空");
  }
  if (text.length > MAX_HUB_TTS_TEXT_LENGTH) {
    throw new Error(`朗读文本过长（最多 ${MAX_HUB_TTS_TEXT_LENGTH} 字）`);
  }

  const hubFetch = resolveHubApiFetch();
  const response = await hubFetch(resolveHubApiUrl("/api/tts/synthesize"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      lang: params.lang ?? undefined,
      voice: params.voice ?? undefined,
      app_locale: params.appLocale,
      rate: params.rate,
      pitch: params.pitch,
      volume: params.volume,
    }),
  });

  if (!response.ok) {
    let message = "语音合成失败";
    try {
      const body = (await response.json()) as { error?: string };
      if (typeof body.error === "string" && body.error.trim()) {
        message = body.error.trim();
      }
    } catch {
      if (response.status === 401) {
        message = "语音合成需要 Hub 认证，请检查 Service API Token";
      }
    }
    throw new Error(message);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error("Hub 未返回音频数据");
  }
  return buffer;
}
