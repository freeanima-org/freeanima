import type { SpeechPlaceholders } from "./plain-text.ts";

/** 组装朗读占位文案（完整消息与未来流式朗读共用）。 */
export function createSpeechPlaceholders(): SpeechPlaceholders {
  return {
    codeBlock: "此处为代码块",
    table: "此处为表格",
    image: "图片省略",
    link: (label) => `链接：${label}`,
  };
}
