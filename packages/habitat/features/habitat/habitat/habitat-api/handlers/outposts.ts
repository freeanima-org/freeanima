import { habitatCtx } from "./runtime.ts";

export async function getOutpostsStatus() {
  const { outpost } = habitatCtx();
  if (!outpost) {
    return {
      instance_count: 0,
      tool_count: 0,
      instances: [],
    };
  }
  return outpost.getStatus();
}
