import { findTagIdByTitle } from "@freeanima/habitat/core/db/pg/tag/find-by-title.ts";
import type { ConversationScenario } from "@freeanima/shared/pg-shapes/entity/enums.ts";

/** system prompt catalog：编码会话可见的 entity 标签名 */
export const CODING_CATALOG_TAG_TITLE = "coding";

export async function resolveCodingCatalogTagId(worldId: number): Promise<number | null> {
  return findTagIdByTitle(worldId, CODING_CATALOG_TAG_TITLE);
}

/** 按会话 scenario 判断 skill/subagent 是否应出现在 system prompt 目录 */
export function entityMatchesScenarioCatalog(
  tagIds: readonly number[],
  codingTagId: number | null,
  scenario: ConversationScenario | null | undefined,
): boolean {
  const canonical =
    scenario === "coding_agent"
      ? "coding_agent"
      : scenario === "room_inner"
        ? "room_inner"
        : "digital_human";

  if (canonical === "coding_agent") {
    return codingTagId != null && tagIds.includes(codingTagId);
  }

  if (tagIds.length === 0) return true;
  if (codingTagId == null) return true;
  const onlyCoding = tagIds.length === 1 && tagIds[0] === codingTagId;
  return !onlyCoding;
}
