import {
  getActiveRuntimeConfig,
  resolveScene,
  type ResolvedScene,
} from "@freeanima/habitat/core/config";
import { connectionEndpointUrl } from "@freeanima/habitat/core/llm/presets";
import { VOICE_PROTOCOL_EDGE_TTS } from "@freeanima/habitat/core/config";
import { transcribeOpenAiSpeech } from "@freeanima/habitat/capabilities/llm-openai/asr-transcribe-openai.ts";

export type TranscribeAsrResult = {
  text: string;
  confidence: number;
};

export type TranscribeAsrInput = {
  bytes: Uint8Array;
  mimeType?: string;
  language?: string;
};

function requireApiKey(scene: ResolvedScene, label: string): string | { error: string } {
  const apiKey = scene.provider.api_key?.trim();
  if (!apiKey && scene.voiceProtocol !== VOICE_PROTOCOL_EDGE_TTS) {
    return { error: `${label}连接缺少 api_key` };
  }
  return apiKey ?? "";
}

/** 按 audio_generate.asr（或 main）场景转写音频 */
export async function transcribeAsrFromScene(
  input: TranscribeAsrInput,
): Promise<TranscribeAsrResult | { error: string }> {
  if (input.bytes.byteLength === 0) {
    return { error: "音频为空" };
  }
  if (input.bytes.byteLength > 8 * 1024 * 1024) {
    return { error: "音频过大（最大 8MB）" };
  }

  let scene: ResolvedScene;
  try {
    scene = resolveScene(getActiveRuntimeConfig().data, "asr");
  } catch {
    try {
      scene = resolveScene(getActiveRuntimeConfig().data, "voice_generate");
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "未配置语音识别场景（audio_generate.asr）",
      };
    }
  }

  const protocol = scene.voiceProtocol ?? scene.audioProtocol;
  if (protocol === VOICE_PROTOCOL_EDGE_TTS) {
    return { error: "Edge TTS 连接不支持语音识别，请配置百炼/OpenAI 兼容 ASR 模型" };
  }

  const apiKey = requireApiKey(scene, "ASR");
  if (typeof apiKey !== "string") return apiKey;

  const baseUrl = connectionEndpointUrl(scene.provider);
  if (!baseUrl) {
    return { error: "ASR 连接缺少 base_url" };
  }

  try {
    const result = await transcribeOpenAiSpeech({
      apiKey,
      baseUrl,
      model: scene.model,
      bytes: input.bytes,
      ...(input.mimeType?.trim() ? { mimeType: input.mimeType.trim() } : {}),
      language: input.language?.trim() || "zh",
    });
    return {
      text: result.text,
      confidence: result.confidence ?? 0.9,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
