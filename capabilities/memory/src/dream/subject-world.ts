import { resolveSubjectWorldId } from "@freeanima/core/config";

export async function resolveDreamWorldId(): Promise<number> {
  return resolveSubjectWorldId("agent");
}
