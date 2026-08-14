/** 策略片段：技能或调用方声明的工具允许/禁止列表 */
export type CapabilityPolicyFragment = {
  allowed_tools: readonly string[];
  denied_tools: readonly string[];
};

/** 合并展开后的有效工具策略（deny 已从 allow 扣除） */
export type ResolvedCapabilityPolicy = {
  allowed_tools: readonly string[];
  denied_tools: readonly string[];
};

/**
 * 能力策略伞形（data 层预留，本期不实现）。
 * 运行时仅消费 tools.* → flat allowed_tools / denied_tools。
 */
export type CapabilityPolicy = {
  tools: CapabilityPolicyFragment;
  data?: CapabilityPolicyFragment;
};
