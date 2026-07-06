export type {
  SatelliteInstanceStatus,
  SatellitesStatusResponse,
} from "@freeanima/capabilities-satellite";

import type { SatellitesStatusResponse } from "@freeanima/capabilities-satellite";

/** SAP satellite runtime management port */
export interface SatelliteManagerPort {
  getStatus(): SatellitesStatusResponse;
  touchHeartbeat(appId: string, instanceId: string): void;
  noteConnection(
    appId: string,
    instanceId: string,
    opts?: { instance_label?: string; httpUrl?: string },
  ): void;
}
