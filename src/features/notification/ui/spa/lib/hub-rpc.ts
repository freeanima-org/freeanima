import { whenBundledSapClientReady } from "@freeanima/shared/sap-contract";

export async function whenSapClientReady() {
  return whenBundledSapClientReady();
}
