import { z } from "zod";

export const DEFAULT_TTS_RATE = 1;
export const DEFAULT_TTS_PITCH = 1;
export const DEFAULT_TTS_VOLUME = 1;
export const DEFAULT_TTS_PREVIEW_TEXT = "你好，我是逸灵风。";

/** Hub 运行时语音配置：由客户端 Web Speech API 消费 */
export const ttsConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    /** BCP 47，如 zh-CN / en-US；留空则跟随应用语言 */
    lang: z.string().optional(),
    /** 与浏览器 SpeechSynthesisVoice.name 模糊匹配 */
    voice_name: z.string().optional(),
    /** 优先选用本机离线语音 */
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
  lang: string | null;
  voiceName: string | null;
  preferLocal: boolean;
  rate: number;
  pitch: number;
  volume: number;
  previewText: string;
};
