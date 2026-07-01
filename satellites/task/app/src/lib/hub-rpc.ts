import { whenBundledSapClientReady } from "@freeanima/sap-contract";

export async function whenSapClientReady() {
  return whenBundledSapClientReady();
}
