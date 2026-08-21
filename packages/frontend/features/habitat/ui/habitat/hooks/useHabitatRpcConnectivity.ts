import { useCallback, useEffect, useState } from "react";

import {
  isHabitatHealthConnected,
  HABITAT_HEALTH_PROBE_TIMEOUT_MS,
} from "@freeanima/client/portal-sdk/habitat-health-probe";
import {
  getHabitatRpcConnectionState,
  reconnectHabitat,
  subscribeHabitatConnection,
  type HabitatConnectionState,
} from "@freeanima/client/portal-sdk/habitat-connection.ts";
import { hubApiFetch } from "@freeanima/features/habitat/ui/habitat/lib/habitat-fetch.ts";
import { resetApiClientCache } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

export type HabitatRpcConnectionState = HabitatConnectionState;

/** 供单测：经 WebView fetch 探 health（与业务 REST 同路径）。 */
export async function probeHabitatHealth(
  fetchFn: (path: string, init?: RequestInit) => Promise<Response> = hubApiFetch,
  timeoutMs = HABITAT_HEALTH_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  try {
    const res = await fetchFn("/rpc/v1/health/probe", {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
    const body = (await res.json()) as { status?: string; authed?: boolean };
    return isHabitatHealthConnected(body);
  } catch (err) {
    logCaughtError("habitat-rpc/probeHabitatHealth", err);
    return false;
  }
}

export function useHabitatRpcConnectivity(enabled: boolean): {
  state: HabitatRpcConnectionState;
  retry: () => Promise<void>;
} {
  const [state, setState] = useState<HabitatRpcConnectionState>(() =>
    enabled && typeof window !== "undefined" ? getHabitatRpcConnectionState() : "connecting",
  );

  const retry = useCallback(async (): Promise<void> => {
    resetApiClientCache();
    try {
      await reconnectHabitat({ force: true });
    } catch (err) {
      logCaughtError("habitat-rpc/useHabitatRpcConnectivity.retry", err);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return () => {};
    setState(getHabitatRpcConnectionState());
    return subscribeHabitatConnection(setState);
  }, [enabled]);

  return { state, retry };
}
