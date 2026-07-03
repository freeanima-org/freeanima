import { consoleCtx } from "./runtime.ts";

export function getFtsStatus() {
  return consoleCtx().getFtsStatus();
}

export function startRebuildFtsIndex(opts?: { onlyMissing?: boolean }) {
  return consoleCtx().startRebuildFtsIndex(opts);
}

export function getRebuildFtsJobStatus() {
  return consoleCtx().getRebuildFtsJobStatus();
}
