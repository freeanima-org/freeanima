import type { ComponentType } from "react";

export type ChatAppComponent = ComponentType;

export async function loadChatApp(): Promise<{ default: ChatAppComponent }> {
  const mod = await import("../../app/src/main.tsx");
  return { default: mod.ChatApp as ChatAppComponent };
}
