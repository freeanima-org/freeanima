import { webuiCtx } from "./runtime.ts";

export function getFtsStatus() {
  return webuiCtx().getFtsStatus();
}

export function startRebuildFtsIndex(opts?: { onlyMissing?: boolean }) {
  return webuiCtx().startRebuildFtsIndex(opts);
}

export function getRebuildFtsJobStatus() {
  return webuiCtx().getRebuildFtsJobStatus();
}
