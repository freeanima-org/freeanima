const DEFAULT_SATELLITE = "http://127.0.0.1:4173";
const STORAGE_KEY = "pair-programming-satellite-url";

let cachedBase: string | null | undefined;
let probePromise: Promise<string | null> | null = null;

function readConfiguredBase(): string | null {
  if (typeof window === "undefined") return null;
  const fromQuery = new URLSearchParams(window.location.search).get("satellite");
  if (fromQuery?.trim()) return fromQuery.trim().replace(/\/$/, "");
  const fromStorage = localStorage.getItem(STORAGE_KEY);
  if (fromStorage?.trim()) return fromStorage.trim().replace(/\/$/, "");
  return DEFAULT_SATELLITE;
}

async function probe(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const body = (await res.json()) as { app?: string };
    return body.app === "pair-programming";
  } catch {
    return false;
  }
}

/** 解析结对编程卫星 HTTP 基址；不可达时返回 null（回退 Hub API） */
export async function resolvePairProgrammingSatelliteBase(): Promise<string | null> {
  if (cachedBase !== undefined) return cachedBase;
  if (probePromise) return probePromise;

  probePromise = (async () => {
    const candidate = readConfiguredBase();
    if (!candidate) {
      cachedBase = null;
      return null;
    }
    if (await probe(candidate)) {
      cachedBase = candidate;
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, candidate);
      }
      return candidate;
    }
    cachedBase = null;
    return null;
  })().finally(() => {
    probePromise = null;
  });

  return probePromise;
}

export function resetPairProgrammingSatelliteCache(): void {
  cachedBase = undefined;
}

async function satelliteFetch<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, init);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function satelliteGetStudioConfig(base: string) {
  return satelliteFetch<Record<string, unknown>>(base, "/api/studio/config");
}

export async function satellitePatchStudioConfig(
  base: string,
  input: { workspace?: string; gitignore?: boolean; showHidden?: boolean },
) {
  return satelliteFetch<Record<string, unknown>>(base, "/api/studio/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function satelliteGetStudioTree(base: string) {
  return satelliteFetch<Record<string, unknown>>(base, "/api/studio/tree");
}

export async function satelliteGetStudioFile(base: string, path: string) {
  return satelliteFetch<Record<string, unknown>>(
    base,
    `/api/studio/file?path=${encodeURIComponent(path)}`,
  );
}

export async function satelliteSearchStudio(base: string, query: string) {
  return satelliteFetch<Record<string, unknown>>(base, "/api/studio/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
}

export async function satelliteListSessions(base: string, platform: string) {
  return satelliteFetch<{ sessions: Array<Record<string, unknown>> }>(
    base,
    `/api/sessions?platform=${encodeURIComponent(platform)}`,
  );
}

export async function satelliteCreateSession(base: string, platform: string) {
  return satelliteFetch<{ session_id: string }>(base, "/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform }),
  });
}

export async function satelliteGetSessionMessages(
  base: string,
  sessionId: string,
  offset?: number,
  limit?: number,
) {
  const params = new URLSearchParams();
  if (offset !== undefined) params.set("offset", String(offset));
  if (limit !== undefined) params.set("limit", String(limit));
  const qs = params.toString();
  return satelliteFetch<Record<string, unknown>>(
    base,
    `/api/sessions/${encodeURIComponent(sessionId)}/messages${qs ? `?${qs}` : ""}`,
  );
}

export async function satelliteSetSessionTitle(base: string, sessionId: string, title: string) {
  return satelliteFetch<{ ok: boolean }>(
    base,
    `/api/sessions/${encodeURIComponent(sessionId)}/title`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    },
  );
}

export function satelliteMessageStreamUrl(base: string): string {
  return `${base}/api/messages/stream`;
}
