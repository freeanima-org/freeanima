import type { StreamFlushContext } from "./offline-module-types.ts";

let chatStreamContextFactory: (() => StreamFlushContext | null) | null = null;

/** Chat SPA 注册当前会话的 stream flush context（供 OfflineSyncBootstrap 使用） */
export function registerChatStreamContextFactory(
  factory: (() => StreamFlushContext | null) | null,
): void {
  chatStreamContextFactory = factory;
}

export function getChatStreamContextFactory(): (() => StreamFlushContext | null) | null {
  return chatStreamContextFactory;
}
