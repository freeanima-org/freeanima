import { omitUndefined } from "../lib/omit-undefined.ts";
import { useCallback, useEffect, useState } from "react";

import {
  isHubHealthConnected,
  HUB_HEALTH_PROBE_TIMEOUT_MS,
  probeHubHealthUrl,
} from "@freeanima/shell-sdk/hub-health-probe";
import { hubApiFetch } from "@console/lib/hub-fetch.ts";
import { resetApiClientCache } from "@console/lib/api.ts";
import { resolveApiOrigin } from "@console/lib/hub-origin.ts";
import { logCaughtError } from "@console/lib/log-caught-error.ts";

export type HubRestConnectionState = "connecting" | "connected" | "disconnected";

const POLL_MS = 30_000;

export async function probeHubHealth(
  fetchFn: (path: string, init?: RequestInit) => Promise<Response> = hubApiFetch,
  timeoutMs = HUB_HEALTH_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  try {
    const res = await fetchFn("/api/health", { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string; authed?: boolean };
    return isHubHealthConnected(body);
  } catch (err) {
    logCaughtError("hub-rest/probeHubHealth", err);
    return false;
  }
}

async function probeHubHealthDefault(): Promise<boolean> {
  try {
    const origin = resolveApiOrigin();
    const token =
      typeof window !== "undefined" ? window.satelliteShell?.remoteAuth?.token : undefined;
    const body = await probeHubHealthUrl(
      origin,
      omitUndefined({
        token,
        timeoutMs: HUB_HEALTH_PROBE_TIMEOUT_MS,
      }),
    );
    return isHubHealthConnected(body);
  } catch (err) {
    logCaughtError("hub-rest/probeHubHealthDefault", err);
    return false;
  }
}

export function useHubRestConnectivity(enabled: boolean): {
  state: HubRestConnectionState;
  retry: () => Promise<void>;
} {
  const [state, setState] = useState<HubRestConnectionState>("connecting");

  const runProbe = useCallback(async (): Promise<void> => {
    setState("connecting");
    const ok = await probeHubHealthDefault();
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
