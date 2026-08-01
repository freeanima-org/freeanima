import { m } from "@freeanima/features/chat/ui/spa/lib/i18n.ts";
import type { SpeechPlaceholders } from "./plain-text.ts";

/** 组装朗读占位文案（完整消息与未来流式朗读共用）。 */
export function createSpeechPlaceholders(): SpeechPlaceholders {
  return {
    codeBlock: m.chat_speech_placeholder_code_block(),
    table: m.chat_speech_placeholder_table(),
    image: m.chat_speech_placeholder_image(),
    link: (label) => m.chat_speech_placeholder_link({ label }),
  };
}
