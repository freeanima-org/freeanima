export {
  resolveHabitatHttpUrl,
  resolveHabitatRpcWsUrl,
  habitatHttpFromRpcWsUrl,
} from "@freeanima/shared/habitat-rpc";

import { habitatHttpFromRpcWsUrl } from "@freeanima/shared/habitat-rpc";

/** WS URL → HTTP origin helper（rpc-contract 历史别名） */
export function habitatHttpFromWsUrl(wsUrl: string): string {
  return habitatHttpFromRpcWsUrl(wsUrl);
}
