import { getServiceContext } from "@freeanima/service-api";

export function getFtsStatus() {
  const { service } = getServiceContext();
  return service.getFtsStatus();
}

export function startRebuildFtsIndex(opts?: { onlyMissing?: boolean }) {
  const { service } = getServiceContext();
  return service.startRebuildFtsIndex(opts);
}

export function getRebuildFtsJobStatus() {
  const { service } = getServiceContext();
  return service.getRebuildFtsJobStatus();
}
