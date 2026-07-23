export type {
  OutpostInstanceStatus,
  OutpostsStatusResponse,
} from "@freeanima/capabilities/remote-tools";

import type { OutpostsStatusResponse } from "@freeanima/capabilities/remote-tools";

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
