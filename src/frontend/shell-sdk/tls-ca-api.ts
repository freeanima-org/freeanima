/** Hub REST 默认 HTTP 端口（与 @freeanima/core/config DEFAULT_HUB_HTTP_PORT 保持一致） */
const DEFAULT_HUB_HTTP_PORT = 2658;

export type TlsCaInfo = {
  available: boolean;
  kind: "mkcert" | "self-signed" | "missing";
  issuer: string | null;
  download_url: string;
  qr_url: string;
  qr_data_url?: string;
  filename: string;
  install_hint: string;
};

function collectTlsCaInfoBases(hubUrl?: string): string[] {
  const bases: string[] = [];
  const push = (raw: string) => {
    try {
      const origin = new URL(raw).origin;
      if (!bases.includes(origin)) bases.push(origin);
    } catch {
      /* ignore */
    }
  };

  if (typeof window !== "undefined" && window.location?.origin) {
    push(window.location.origin);
    try {
      const page = new URL(window.location.origin);
      if (page.protocol === "https:") {
        page.protocol = "http:";
        if (!page.port || page.port === "2659") page.port = String(DEFAULT_HUB_HTTP_PORT);
        push(page.origin);
      }
    } catch {
      /* ignore */
    }
  }

  const trimmed = hubUrl?.trim();
  if (trimmed) {
    push(trimmed);
    try {
      const hub = new URL(trimmed);
      if (hub.protocol === "https:") {
        hub.protocol = "http:";
        if (!hub.port || hub.port === "2659") hub.port = String(DEFAULT_HUB_HTTP_PORT);
        push(hub.origin);
      }
    } catch {
      /* ignore */
    }
  }

  push(`http://127.0.0.1:${DEFAULT_HUB_HTTP_PORT}`);
  return bases;
}

export async function fetchTlsCaInfo(hubUrl?: string): Promise<TlsCaInfo> {
  const bases = collectTlsCaInfoBases(hubUrl);
  let lastError: Error | undefined;
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/api/tls/ca/info`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`TLS CA 信息不可用（${res.status}）`);
      }
      return (await res.json()) as TlsCaInfo;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("TLS CA 信息不可用");
}
