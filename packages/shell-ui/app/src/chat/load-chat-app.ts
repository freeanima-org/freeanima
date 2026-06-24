import type { ComponentType } from "react";

export type ChatAppComponent = ComponentType;

/** 运行时由 shell-ui bundler 解析 chat 入口 */
export async function loadChatApp(): Promise<{ default: ChatAppComponent }> {
  // @ts-expect-error 跨包动态入口，类型在 satellites/chat 工程内校验
  const mod = (await import("../../../../../satellites/chat/app/src/ChatApp.tsx")) as {
    ChatApp: ChatAppComponent;
  };
  return { default: mod.ChatApp };
}
