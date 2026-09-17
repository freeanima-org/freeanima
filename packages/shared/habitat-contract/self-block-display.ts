import type { SelfBlockKey } from "@freeanima/shared/pg-shapes/entity";

/** Self 层块展示（协议类型；非 platform 实现细节） */
export type SelfBlockDisplay = {
  block_key: SelfBlockKey;
  heading: string;
  content: string;
  locked: boolean;
  version: number;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};
