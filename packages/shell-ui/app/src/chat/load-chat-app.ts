import type { ComponentType } from "react";

import "../../../../../satellites/chat/app/src/styles.css";

export type ChatAppComponent = ComponentType;

export { ChatApp } from "../../../../../satellites/chat/app/src/ChatApp.tsx";

/** 运行时由 shell-ui bundler 解析 chat 入口（兼容旧 lazy 调用方） */
export async function loadChatApp(): Promise<{ default: ChatAppComponent }> {
  const mod = await import("../../../../../satellites/chat/app/src/ChatApp.tsx");
  return { default: mod.ChatApp };
}
