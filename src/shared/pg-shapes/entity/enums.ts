import { z } from "zod";

export const taskItemStatusSchema = z.enum(["pending", "completed"]);
export type TaskItemStatus = z.infer<typeof taskItemStatusSchema>;

export const taskItemPrioritySchema = z.enum(["high", "medium", "low", "none"]);
export type TaskItemPriority = z.infer<typeof taskItemPrioritySchema>;

export const vaultItemTypeSchema = z.enum(["login", "secure_note", "card", "identity", "custom"]);
export type VaultItemType = z.infer<typeof vaultItemTypeSchema>;

export const selfBlockKeySchema = z.enum([
  "existence_anchor",
  "self_model",
  "personality_baseline",
  "direction",
  "metacognition",
]);
export type SelfBlockKey = z.infer<typeof selfBlockKeySchema>;

export const conversationModuleSchema = z.enum(["chat", "coding"]);
export type ConversationModule = z.infer<typeof conversationModuleSchema>;
