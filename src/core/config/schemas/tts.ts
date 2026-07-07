import { z } from "zod";

export const DEFAULT_TTS_RATE = 1;
export const DEFAULT_TTS_PITCH = 1;
export const DEFAULT_TTS_VOLUME = 1;
export const DEFAULT_TTS_PREVIEW_TEXT = "你好，我是逸灵风。";

export const TTS_PROVIDERS = ["edge-tts", "web-speech"] as const;
export type TtsProvider = (typeof TTS_PROVIDERS)[number];
export const DEFAULT_TTS_PROVIDER: TtsProvider = "edge-tts";

/** Hub 运行时语音配置：客户端按 provider 消费 */
export const ttsConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    /** edge-tts（Hub 合成）或 web-speech（浏览器本机） */
    provider: z.enum(TTS_PROVIDERS).optional(),
    /** BCP 47，如 zh-CN / en-US；留空则跟随应用语言 */
    lang: z.string().optional(),
    /** Edge Neural 名或浏览器 SpeechSynthesisVoice.name */
    voice_name: z.string().optional(),
    /** 优先选用本机离线语音（仅 web-speech） */
    prefer_local: z.boolean().optional(),
    rate: z.number().min(0.1).max(10).optional(),
    pitch: z.number().min(0).max(2).optional(),
    volume: z.number().min(0).max(1).optional(),
    preview_text: z.string().optional(),
  })
  .optional();

export type TtsConfigInput = z.infer<typeof ttsConfigSchema>;

export type ResolvedSpeechConfig = {
  enabled: boolean;
  provider: TtsProvider;
  lang: string | null;
  voiceName: string | null;
  preferLocal: boolean;
  rate: number;
  pitch: number;
  volume: number;
  previewText: string;
};
