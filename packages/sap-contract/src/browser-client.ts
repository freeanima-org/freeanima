/** @deprecated Use direct-client.ts */
export {
  createSapDirectClient as createSapBrowserClient,
  loadDirectSatelliteConfig as loadChatSatelliteConfig,
  type SapDirectClient as SapBrowserClient,
  type SapDirectClientOptions as SapBrowserClientOptions,
  type DirectSatelliteConfig as ChatSatelliteConfig,
} from "./direct-client.ts";

export type { SubscribeCallbacks } from "./conversation-stream-core.ts";
