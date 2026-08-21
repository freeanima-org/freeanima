import { habitatCtx } from "./runtime.ts";
import {
  selfBlocksBodySchema,
  type SelfBlocksBody,
} from "@freeanima/features/habitat/habitat/habitat-api/api";

export async function listSelfBlocks(body: SelfBlocksBody = {}) {
  const parsed = selfBlocksBodySchema.parse(body ?? {});
  return habitatCtx().listSelfBlocks(parsed.agent_subject_id);
}
