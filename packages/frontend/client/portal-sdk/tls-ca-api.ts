import { isRecord } from "@freeanima/shared/util";

/** Habitat REST 默认 HTTP 端口（与 @freeanima/habitat/core/config DEFAULT_HABITAT_HTTP_PORT 保持一致） */
import { habitatTlsCaInfoUrl } from "@freeanima/shared/habitat-rpc";

const DEFAULT_HABITAT_HTTP_PORT = 2658;

export type TlsCaInfo = {
  available: boolean;
  kind: "mkcert" | "self-signed" | "letsencrypt" | "missing";
  issuer: string | null;
  download_url: string;
  qr_url: string;
  qr_data_url?: string;
  filename: string;
  install_hint: string;
};

const TLS_CA_KINDS = ["mkcert", "self-signed", "letsencrypt", "missing"] as const;

function isTlsCaKind(value: string): value is TlsCaInfo["kind"] {
  return (TLS_CA_KINDS as readonly string[]).includes(value);
}

function parseTlsCaInfo(raw: unknown): TlsCaInfo | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.available !== "boolean") return null;
  if (typeof raw.kind !== "string" || !isTlsCaKind(raw.kind)) return null;
  if (raw.issuer !== null && typeof raw.issuer !== "string") return null;
  if (typeof raw.download_url !== "string") return null;
  if (typeof raw.qr_url !== "string") return null;
  if (typeof raw.filename !== "string") return null;
  if (typeof raw.install_hint !== "string") return null;
  return {
    available: raw.available,
    kind: raw.kind,
    issuer: raw.issuer,
    download_url: raw.download_url,
    qr_url: raw.qr_url,
    filename: raw.filename,
    install_hint: raw.install_hint,
    ...(typeof raw.qr_data_url === "string" ? { qr_data_url: raw.qr_data_url } : {}),
  };
}

function collectTlsCaInfoBases(habitatUrl?: string): string[] {
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
        if (!page.port || page.port === "2659") page.port = String(DEFAULT_HABITAT_HTTP_PORT);
        push(page.origin);
      }
    } catch {
      /* ignore */
    }
  }

  const trimmed = habitatUrl?.trim();
  if (trimmed) {
    push(trimmed);
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "https:") {
        parsed.protocol = "http:";
        if (!parsed.port || parsed.port === "2659") parsed.port = String(DEFAULT_HABITAT_HTTP_PORT);
        push(parsed.origin);
      }
    } catch {
      /* ignore */
    }
  }

  push(`http://127.0.0.1:${DEFAULT_HABITAT_HTTP_PORT}`);
  return bases;
}

export async function fetchTlsCaInfo(habitatUrl?: string): Promise<TlsCaInfo> {
  const bases = collectTlsCaInfoBases(habitatUrl);
  let lastError: Error | undefined;
  for (const base of bases) {
    try {
      const res = await fetch(habitatTlsCaInfoUrl(base), { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`TLS CA 信息不可用（${res.status}）`);
      }
      const parsed = parseTlsCaInfo(await res.json());
      if (!parsed) {
        throw new Error("TLS CA 信息格式无效");
      }
      return parsed;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("TLS CA 信息不可用");
}
