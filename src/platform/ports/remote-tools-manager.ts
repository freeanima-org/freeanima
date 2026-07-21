export type {
  SatelliteInstanceStatus,
  SatellitesStatusResponse,
} from "@freeanima/capabilities/remote-tools";

import type { SatellitesStatusResponse } from "@freeanima/capabilities/remote-tools";

/** SAP satellite runtime management port */
export interface RemoteToolsManagerPort {
  getStatus(): SatellitesStatusResponse;
  touchHeartbeat(appId: string, instanceId: string): void;
  noteConnection(
    appId: string,
    instanceId: string,
    opts?: { instance_label?: string; httpUrl?: string },
  ): void;
}
