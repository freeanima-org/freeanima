import { useCallback, useEffect, useState } from "react";

import { hubApiFetch } from "@/lib/hub-fetch.ts";
import { resetApiClientCache } from "@/lib/api.ts";

export type HubRestConnectionState = "connecting" | "connected" | "disconnected";

const POLL_MS = 30_000;

export async function probeHubHealth(
  fetchFn: (path: string, init?: RequestInit) => Promise<Response> = hubApiFetch,
): Promise<boolean> {
  try {
    const res = await fetchFn("/api/health");
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}

async function probeHubHealthDefault(): Promise<boolean> {
  return probeHubHealth();
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
