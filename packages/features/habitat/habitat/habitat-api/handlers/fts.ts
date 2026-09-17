import { habitatCtx } from "./runtime.ts";

export function getFtsStatus() {
  return habitatCtx().getFtsStatus();
}

export function startRebuildFtsIndex(opts?: { onlyMissing?: boolean }) {
  return habitatCtx().startRebuildFtsIndex(opts);
}

export function getRebuildFtsJobStatus() {
  return habitatCtx().getRebuildFtsJobStatus();
}
