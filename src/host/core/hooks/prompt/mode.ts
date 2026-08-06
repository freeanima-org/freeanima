/** Prompt 组装模式：与 platform（通道身份）正交，由 conversations.module 派生。 */

export type ConversationModule = "chat" | "coding";

export type PromptMode = "digital_human" | "work";

/** `coding` → 工作模式；缺省 / 其它 → 数字人类模式（向后兼容）。 */
export function resolvePromptMode(module?: string | null): PromptMode {
  return module === "coding" ? "work" : "digital_human";
}
