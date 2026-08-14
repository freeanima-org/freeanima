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

/** 会话情景行为档（与 platform 通道身份正交） */
export const conversationScenarioSchema = z.enum(["digital_human", "coding_agent"]);
export type ConversationScenario = z.infer<typeof conversationScenarioSchema>;
