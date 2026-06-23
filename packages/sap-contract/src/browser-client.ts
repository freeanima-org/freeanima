/** @deprecated Use direct-client.ts */
export {
  createSapDirectClient as createSapBrowserClient,
  loadDirectSatelliteConfig as loadParlorSatelliteConfig,
  type SapDirectClient as SapBrowserClient,
  type SapDirectClientOptions as SapBrowserClientOptions,
  type DirectSatelliteConfig as ParlorSatelliteConfig,
} from "./direct-client.ts";

export type { SubscribeCallbacks } from "./session-stream-core.ts";
