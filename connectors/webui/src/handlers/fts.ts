import { webuiCtx } from "./runtime.ts";

export function getFtsStatus() {
  const { service } = webuiCtx();
  return service.getFtsStatus();
}

export function startRebuildFtsIndex(opts?: { onlyMissing?: boolean }) {
  const { service } = webuiCtx();
  return service.startRebuildFtsIndex(opts);
}

export function getRebuildFtsJobStatus() {
  const { service } = webuiCtx();
  return service.getRebuildFtsJobStatus();
}
