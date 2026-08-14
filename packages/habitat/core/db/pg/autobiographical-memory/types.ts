import type {
  NarrativeSignificance,
  NarrativeStatus,
} from "@freeanima/habitat/core/db/schema/entity";
import type { AutobiographicalMemoryRow } from "@freeanima/habitat/core/db/schema/rows";

export type AutobiographicalSignificance = NarrativeSignificance;
export type AutobiographicalStatus = NarrativeStatus;
export type { AutobiographicalMemoryRow };

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
