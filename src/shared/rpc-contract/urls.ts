export {
  resolveHabitatHttpUrl,
  resolveHabitatRpcWsUrl,
  habitatHttpFromRpcWsUrl,
} from "@freeanima/shared/habitat-rpc";

import { resolveHabitatRpcWsUrl, habitatHttpFromRpcWsUrl } from "@freeanima/shared/habitat-rpc";

/** @deprecated 使用 resolveHabitatRpcWsUrl */
export function resolveHubWsUrl(habitatUrl: string): string {
  return resolveHabitatRpcWsUrl(habitatUrl);
}

/** @deprecated 使用 habitatHttpFromRpcWsUrl */
export function habitatHttpFromWsUrl(wsUrl: string): string {
  return habitatHttpFromRpcWsUrl(wsUrl);
}
