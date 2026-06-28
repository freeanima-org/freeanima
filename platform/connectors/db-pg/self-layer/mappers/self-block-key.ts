import { selfBlockKeySchema, type SelfBlockKey } from "@freeanima/core/db/schema";

export function normalizeSelfBlockKey(raw: string): SelfBlockKey {
  const parsed = selfBlockKeySchema.safeParse(raw.trim());
  if (!parsed.success) {
    throw new Error(`invalid self block key: ${raw}`);
  }
  return parsed.data;
}
