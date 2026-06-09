import { getServiceContext } from "@freeanima/service-api";

export async function listSelfBlocks() {
  const { service } = getServiceContext();
  return service.listSelfBlocks();
}
