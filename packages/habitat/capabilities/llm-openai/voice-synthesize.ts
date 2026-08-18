import {
  getActiveRuntimeConfig,
  VOICE_PROTOCOL_ALIBABA_AUDIO,
  VOICE_PROTOCOL_EDGE_TTS,
  VOICE_PROTOCOL_OPENAI_AUDIO,
  resolveScene,
  edgeTtsProxyFromBaseUrl,
  DEFAULT_EDGE_TTS_BASE_URL,
  type ResolvedScene,
} from "@freeanima/habitat/core/config";
import { materializeConnection } from "@freeanima/habitat/core/llm/presets";
import { isAlibabaRealtimeVoiceModel } from "@freeanima/habitat/core/llm/voice-generate-models";
import {
  mergeVoiceProsodyParams,
  mapVoiceProsodyToAlibabaTts,
  mapVoiceProsodyToEdge,
  mapVoiceProsodyToOpenAiSpeech,
  readVoiceProsodyParams,
  type VoiceProsodyParams,
} from "@freeanima/habitat/core/tts/voice-params";
import {
  defaultVoiceIdForProtocol,
  formatVoiceIdsForToolHint,
} from "@freeanima/habitat/core/tts/voice-catalog";
import { synthesizeEdgeTts } from "@freeanima/habitat/core/tts/edge-synthesize";
import { generateOpenAiSpeech } from "@freeanima/habitat/capabilities/llm-openai/audio-speech";
import {
  assertAlibabaRealtimeModelReady,
  synthesizeAlibabaTts,
} from "@freeanima/habitat/capabilities/llm-openai/audio-alibaba";
import { coerceString } from "@freeanima/shared/coerce-string";

export type SynthesizeVoiceResult = {
  bytes: Uint8Array;
  mimeType: string;
};

export type SynthesizeVoiceInput = {
  text: string;
  /** 覆盖场景 params */
  prosody?: VoiceProsodyParams;
  purpose?: "voice_generate" | "tts" | "voice_realtime";
};

function requireApiKey(scene: ResolvedScene, label: string): string | { error: string } {
  const apiKey = scene.provider.api_key?.trim();
  if (!apiKey && scene.voiceProtocol !== VOICE_PROTOCOL_EDGE_TTS) {
    return { error: `${label}连接缺少 api_key` };
  }
  return apiKey ?? "";
}

/** 按 voice_generate / tts / voice_realtime 场景合成音频（批量，非 realtime 双工） */
export async function synthesizeVoiceFromScene(
  input: SynthesizeVoiceInput,
): Promise<SynthesizeVoiceResult | { error: string }> {
  const purpose = input.purpose ?? "voice_generate";
  if (purpose === "voice_realtime") {
    return { error: "实时语音对话子场景尚未提供批量合成；请使用文生声或朗读" };
  }

  let scene: ResolvedScene;
  try {
    scene = resolveScene(getActiveRuntimeConfig().data, purpose);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : `未配置语音合成场景（llm.scenes.${purpose}）`,
    };
  }

  if (isAlibabaRealtimeVoiceModel(scene.model)) {
    try {
      assertAlibabaRealtimeModelReady(scene.model);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  const protocol = scene.voiceProtocol;
  if (!protocol) {
    return { error: "该连接未配置语音协议（voice_protocol）" };
  }

  const sceneProsody = readVoiceProsodyParams(scene.params ?? {});
  const prosody = mergeVoiceProsodyParams(sceneProsody, input.prosody);

  let baseUrl: string;
  try {
    if (protocol === VOICE_PROTOCOL_EDGE_TTS) {
      baseUrl = (scene.provider.base_url?.trim() || DEFAULT_EDGE_TTS_BASE_URL).replace(/\/$/, "");
    } else {
      baseUrl = materializeConnection(scene.provider).baseUrl;
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "语音连接 Base URL 无效" };
  }

  const text = coerceString(input.text).trim();
  if (!text) return { error: "合成文本不能为空" };

  try {
    if (protocol === VOICE_PROTOCOL_EDGE_TTS) {
      const mapped = mapVoiceProsodyToEdge(prosody);
      const proxy = edgeTtsProxyFromBaseUrl(baseUrl);
      const buf = await synthesizeEdgeTts({
        text,
        voice: mapped.voice ?? scene.model,
        rate: mapped.rate,
        pitch: mapped.pitch,
        volume: mapped.volume,
        ...(proxy ? { proxy } : {}),
      });
      return { bytes: new Uint8Array(buf), mimeType: "audio/mpeg" };
    }

    if (protocol === VOICE_PROTOCOL_OPENAI_AUDIO) {
      const key = requireApiKey(scene, "文生声");
      if (typeof key === "object") return key;
      const mapped = mapVoiceProsodyToOpenAiSpeech(prosody);
      const voice =
        mapped.voice ??
        defaultVoiceIdForProtocol(VOICE_PROTOCOL_OPENAI_AUDIO, scene.model) ??
        "alloy";
      return await generateOpenAiSpeech({
        apiKey: key,
        baseUrl,
        model: scene.model,
        text,
        voice,
        speed: mapped.speed,
        responseFormat: mapped.response_format,
        ...(scene.provider.timeout_ms != null ? { timeoutMs: scene.provider.timeout_ms } : {}),
      });
    }

    if (protocol === VOICE_PROTOCOL_ALIBABA_AUDIO) {
      const key = requireApiKey(scene, "文生声");
      if (typeof key === "object") return key;
      const mapped = mapVoiceProsodyToAlibabaTts(prosody);
      const voice =
        mapped.voice ?? defaultVoiceIdForProtocol(VOICE_PROTOCOL_ALIBABA_AUDIO, scene.model);
      if (!voice) {
        const hint =
          formatVoiceIdsForToolHint(VOICE_PROTOCOL_ALIBABA_AUDIO, scene.model) ||
          formatVoiceIdsForToolHint(VOICE_PROTOCOL_ALIBABA_AUDIO);
        return {
          error: hint
            ? `阿里云文生声需要音色（scenes.params.voice 或 tool.voice）。常用：${hint}`
            : "阿里云文生声需要音色（scenes.params.voice 或 tool.voice）",
        };
      }
      return await synthesizeAlibabaTts({
        apiKey: key,
        baseUrl,
        model: scene.model,
        text,
        voice,
        rate: mapped.rate,
        pitch: mapped.pitch,
        volume: mapped.volume,
        format: mapped.format,
        sampleRate: mapped.sample_rate,
        ...(scene.provider.timeout_ms != null ? { timeoutMs: scene.provider.timeout_ms } : {}),
      });
    }

    return { error: `不支持的语音协议: ${String(protocol)}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "语音合成失败" };
  }
}
