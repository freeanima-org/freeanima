export type {
  OutpostInstanceStatus,
  OutpostsStatusResponse,
} from "@freeanima/host/capabilities/outpost";

import type { OutpostsStatusResponse } from "@freeanima/host/capabilities/outpost";

/** Outpost remote-tools runtime management port */
export interface RemoteToolsManagerPort {
  getStatus(): OutpostsStatusResponse;
  touchHeartbeat(appId: string, instanceId: string): void;
  noteConnection(
    appId: string,
    instanceId: string,
    opts?: { instance_label?: string; httpUrl?: string },
  ): void;
}
