/**
 * 运行时已校验后的类型收窄闸口。
 * 禁止用于「猜类型」；优先 Zod.parse / 类型守卫 / 收窄分支。
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- 返回类型 T 是闸口契约，非可删冗余
export function assertNarrow<T>(value: unknown): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 全仓唯一收窄闸口；调用方须已校验
  return value as T;
}
