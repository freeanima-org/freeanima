import { omitUndefined } from "../lib/omit-undefined.ts";
import { useCallback, useEffect, useState } from "react";

import {
  isHabitatHealthConnected,
  HABITAT_HEALTH_PROBE_TIMEOUT_MS,
  probeHabitatHealthUrl,
} from "@freeanima/frontend/portal-sdk/habitat-health-probe";
import { hubApiFetch } from "@freeanima/features/habitat/ui/habitat/lib/habitat-fetch.ts";
import { resetApiClientCache } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { resolveApiOrigin } from "@freeanima/features/habitat/ui/habitat/lib/habitat-origin.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

export type HabitatRpcConnectionState = "connecting" | "connected" | "disconnected";

const POLL_MS = 30_000;

export async function probeHabitatHealth(
  fetchFn: (path: string, init?: RequestInit) => Promise<Response> = hubApiFetch,
  timeoutMs = HABITAT_HEALTH_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  try {
    const res = await fetchFn("/rpc/v1/health/probe", {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string; authed?: boolean };
    return isHabitatHealthConnected(body);
  } catch (err) {
    logCaughtError("habitat-rpc/probeHabitatHealth", err);
    return false;
  }
}

async function probeHabitatHealthDefault(): Promise<boolean> {
  try {
    const origin = resolveApiOrigin();
    const token = typeof window !== "undefined" ? window.portalShell?.remoteAuth?.token : undefined;
    const body = await probeHabitatHealthUrl(
      origin,
      omitUndefined({
        token,
        timeoutMs: HABITAT_HEALTH_PROBE_TIMEOUT_MS,
      }),
    );
    return isHabitatHealthConnected(body);
  } catch (err) {
    logCaughtError("habitat-rpc/probeHabitatHealthDefault", err);
    return false;
  }
}

export function useHabitatRpcConnectivity(enabled: boolean): {
  state: HabitatRpcConnectionState;
  retry: () => Promise<void>;
} {
  const [state, setState] = useState<HabitatRpcConnectionState>("connecting");

  const runProbe = useCallback(async (): Promise<void> => {
    setState("connecting");
    const ok = await probeHabitatHealthDefault();
    setState(ok ? "connected" : "disconnected");
  }, []);

  const retry = useCallback(async (): Promise<void> => {
    resetApiClientCache();
    await runProbe();
  }, [runProbe]);

  useEffect(() => {
    if (!enabled) return;
    void runProbe();
  }, [enabled, runProbe]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = (): void => {
      if (document.visibilityState === "visible") void runProbe();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, runProbe]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => void runProbe(), POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, runProbe]);

  return { state, retry };
}
