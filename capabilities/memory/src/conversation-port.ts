import type { ConversationStorePort } from "@freeanima/core/repos";

import { createMemoryPortRegistry } from "./port-registry.ts";

const conversation = createMemoryPortRegistry<ConversationStorePort>("memory ConversationStore");

/** Injected by platform at startup (avoids capabilities ↔ db-pg direct dependency) */
export const registerMemoryConversationStore = conversation.register;
export const getMemoryConversationStore = conversation.get;
export const resetMemoryConversationStoreForTests = conversation.resetForTests;
