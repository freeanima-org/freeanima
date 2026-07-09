/** Hub HTTP origin → Hub RPC WebSocket URL */
export function resolveHubWsUrl(hubUrl: string): string {
  return hubUrl.replace(/\/$/, "").replace(/^http/, "ws") + "/hub/rpc/v1";
}

export {
  resolveHubRpcWsUrl,
  hubHttpFromRpcWsUrl,
  resolveHubHttpUrl,
} from "@freeanima/shared/hub-rpc";
