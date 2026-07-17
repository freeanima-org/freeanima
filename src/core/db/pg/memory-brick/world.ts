import { resolveSubjectWorldId } from "@freeanima/core/config";

/** 记忆砖块（limbic / narrative / dream）写入 agent default private world */
export async function resolveMemoryBrickWorldId(): Promise<number> {
  return resolveSubjectWorldId("agent");
}
