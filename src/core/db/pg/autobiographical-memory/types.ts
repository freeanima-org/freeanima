import type {
  AutobiographicalSignificance,
  AutobiographicalStatus,
} from "@freeanima/core/db/schema";
import type { AutobiographicalMemoryRow } from "@freeanima/core/db/schema/rows";

export type { AutobiographicalSignificance, AutobiographicalStatus, AutobiographicalMemoryRow };

export type AutobiographicalMemoryCreateInput = {
  title: string;
  content: string;
  significance?: AutobiographicalSignificance;
  period_start?: string | null;
  period_end?: string | null;
  /** Maps to PG column `source_facts` */
  source_semantic_memory?: string[];
  source_conversations?: string[];
  id?: string;
};

export type AutobiographicalListOrder = "updated_desc" | "significance_desc";

export type AutobiographicalListOpts = {
  query?: string;
  offset?: number;
  limit?: number;
  status?: AutobiographicalStatus;
  significance?: AutobiographicalSignificance;
  source_conversation?: string;
};

export type AutobiographicalFtsHit = AutobiographicalMemoryRow & {
  rank: number;
};
