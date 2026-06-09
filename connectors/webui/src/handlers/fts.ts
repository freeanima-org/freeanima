import { getServiceContext } from "@freeanima/service-api";

export function getFtsStatus() {
  const { service } = getServiceContext();
  return service.getFtsStatus();
}

export async function rebuildFtsIndex() {
  const { service } = getServiceContext();
  return service.rebuildFtsIndex();
}
