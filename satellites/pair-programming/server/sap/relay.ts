export {
  createSapRelayServerState,
  attachHubEventFanout,
  handleRelayWsOpen,
  handleRelayWsClose,
  handleRelayWsMessage,
  type RelayWsData,
  type SapRelayServerState,
} from "@freeanima/sap-contract";

import { createSapRelayServerState } from "@freeanima/sap-contract";

/** @deprecated Use getRelayState() from hub.ts */
export const relayState = createSapRelayServerState();
