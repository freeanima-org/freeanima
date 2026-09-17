/**
 * 会话情景行为档（scenario）：与 platform（通道身份）正交。
 * Prompt / 旁注 / 压缩等行为由 profile 派生；入口一律是 scenario，不再经 module。
 */

import {
  conversationScenarioSchema,
  type ConversationScenario,
} from "@freeanima/shared/pg-shapes/entity/enums.ts";

export { conversationScenarioSchema, type ConversationScenario };

/** profile.prompt 取值；保留别名便于钩子门控 */
export type PromptMode = "digital_human" | "work";

export type ScenarioProfile = {
  prompt: PromptMode;
  // 旁注 / 压缩等行为档扩展点（后续按需加字段）
};

/** 空 / 非法 → `digital_human` */
export function canonicalizeConversationScenario(raw?: string | null): ConversationScenario {
  const parsed = conversationScenarioSchema.safeParse(raw);
  return parsed.success ? parsed.data : "digital_human";
}

export function resolveScenarioProfile(scenario?: string | null): ScenarioProfile {
  const canonical = canonicalizeConversationScenario(scenario);
  // room_inner 与 digital_human 同用数字人类提示栈；协议段由专用钩子按 scenario 注入
  return {
    prompt: canonical === "coding_agent" ? "work" : "digital_human",
  };
}
