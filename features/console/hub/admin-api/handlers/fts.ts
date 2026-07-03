import { adminCtx } from "./runtime.ts";

export function getFtsStatus() {
  return adminCtx().getFtsStatus();
}

export function startRebuildFtsIndex(opts?: { onlyMissing?: boolean }) {
  return adminCtx().startRebuildFtsIndex(opts);
}

export function getRebuildFtsJobStatus() {
  return adminCtx().getRebuildFtsJobStatus();
}
