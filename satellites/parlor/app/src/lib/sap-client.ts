import {
  createSapBrowserClient,
  PARLOR_PLATFORM,
  type SapBrowserClient,
} from "@freeanima/sap-contract";

let client: SapBrowserClient | null = null;

export function getSapBrowserClient(): SapBrowserClient {
  if (!client) {
    client = createSapBrowserClient();
  }
  return client;
}

export { PARLOR_PLATFORM };
