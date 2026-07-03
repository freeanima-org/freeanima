import { useEffect, useState } from "react";

import {
  getHubRpcConnectionState,
  subscribeHubConnection,
  type HubConnectionState,
} from "./hub-connection.ts";

/** 与 Hub 的 HubRPC WebSocket 连接状态 */
export function useHubConnection(): HubConnectionState {
  const [connection, setConnection] = useState<HubConnectionState>(() =>
    typeof window !== "undefined" ? getHubRpcConnectionState() : "connecting",
  );

  useEffect(() => {
    return subscribeHubConnection(setConnection);
  }, []);

  return connection;
}
