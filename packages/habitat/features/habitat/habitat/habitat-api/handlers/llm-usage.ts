import { habitatCtx } from "./runtime.ts";

export async function getUsageToday() {
  return habitatCtx().getUsageToday();
}
