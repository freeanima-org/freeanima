export type ReflectChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ReflectChatResponse = {
  content: string | null;
};

export type ReflectChatFn = (messages: ReflectChatMessage[]) => Promise<ReflectChatResponse>;

let reflectChat: ReflectChatFn | null = null;

/** 由 runtime/server 在启动时注入 engine.chat，避免 memory↔engine 循环依赖 */
export function registerReflectChat(fn: ReflectChatFn): void {
  reflectChat = fn;
}

export async function callReflectChat(
  messages: ReflectChatMessage[],
): Promise<ReflectChatResponse> {
  if (!reflectChat) {
    throw new Error("memory reflect LLM 未配置：请在服务启动时调用 registerReflectChat()");
  }
  return reflectChat(messages);
}
