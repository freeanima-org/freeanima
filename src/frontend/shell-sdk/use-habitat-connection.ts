import { useEffect, useState } from "react";

import {
  getHabitatRpcConnectionState,
  subscribeHabitatConnection,
  type HabitatConnectionState,
} from "./habitat-connection.ts";

/** 与 Habitat 的 HubRPC WebSocket 连接状态 */
export function useHabitatConnection(): HabitatConnectionState {
  const [connection, setConnection] = useState<HabitatConnectionState>(() =>
    typeof window !== "undefined" ? getHabitatRpcConnectionState() : "connecting",
  );

  useEffect(() => {
    return subscribeHabitatConnection(setConnection);
  }, []);

  return connection;
}
