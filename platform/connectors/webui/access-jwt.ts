import type { TunnelAccessConfig } from "@freeanima/core/config";
import { isAuthExemptPath, isLocalDirectConnection } from "./remote-auth.ts";

export type AccessJwtConfig = {
  teamName: string;
  audience: string;
  allowedEmails: string[];
  enabled: boolean;
};

export type AccessJwtVerifier = {
  verifyRequest(req: Request, remoteAddress?: string): Promise<Response | null>;
  preload(): Promise<void>;
};

const CF_JWT_HEADER = "cf-access-jwt-assertion";

type CachedCert = {
  kid: string;
  certPem: string;
  key: CryptoKey;
  expiresAt: number;
};

let certCache: CachedCert[] = [];
let certCacheTeam = "";
let certCacheFetchedAt = 0;
const CERT_CACHE_TTL_MS = 60 * 60 * 1000;

function normalizeHeader(req: Request, name: string): string | null {
  return req.headers.get(name) ?? req.headers.get(name.toLowerCase()) ?? null;
}

function parseJwtParts(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  sig: Uint8Array;
  signed: Uint8Array;
} | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(atob(parts[0]!.replace(/-/g, "+").replace(/_/g, "/"))) as Record<
      string,
      unknown
    >;
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as Record<
      string,
      unknown
    >;
    const sigB64 = parts[2]!.replace(/-/g, "+").replace(/_/g, "/");
    const sigPad = sigB64 + "=".repeat((4 - (sigB64.length % 4)) % 4);
    const sigBin = atob(sigPad);
    const sig = new Uint8Array(sigBin.length);
    for (let i = 0; i < sigBin.length; i++) sig[i] = sigBin.charCodeAt(i);
    const signedStr = `${parts[0]}.${parts[1]}`;
    const signed = new TextEncoder().encode(signedStr);
    return { header, payload, sig, signed };
  } catch {
    return null;
  }
}

type AccessCertsBody = {
  keys?: Array<{
    kid: string;
    kty?: string;
    n?: string;
    e?: string;
    alg?: string;
    use?: string;
  }>;
  public_cert?: { kid: string; cert: string };
  public_certs?: Array<{ kid: string; cert: string }>;
};

async function importJwkKey(jwk: {
  kid: string;
  kty?: string;
  n?: string;
  e?: string;
  alg?: string;
}): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: jwk.kty ?? "RSA",
      n: jwk.n!,
      e: jwk.e!,
      alg: jwk.alg ?? "RS256",
      ext: true,
    },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

/** 解析 Cloudflare Access certs：用 JWK keys 验签，kid 列表对齐 public_certs */
export async function parseAccessCertsBody(body: AccessCertsBody): Promise<CachedCert[]> {
  const now = Date.now();
  const jwkKeys = (body.keys ?? []).filter(
    (k): k is { kid: string; kty: string; n: string; e: string; alg?: string } =>
      Boolean(k.kid && k.kty === "RSA" && k.n && k.e),
  );

  const allowedKids = new Set<string>();
  if (body.public_certs?.length) {
    for (const entry of body.public_certs) {
      if (entry.kid) allowedKids.add(entry.kid);
    }
  } else if (body.public_cert?.kid) {
    allowedKids.add(body.public_cert.kid);
  }

  const selected = allowedKids.size > 0 ? jwkKeys.filter((k) => allowedKids.has(k.kid)) : jwkKeys;

  const certs: CachedCert[] = [];
  for (const entry of selected) {
    certs.push({
      kid: entry.kid,
      certPem:
        body.public_certs?.find((p) => p.kid === entry.kid)?.cert ?? body.public_cert?.cert ?? "",
      key: await importJwkKey(entry),
      expiresAt: now + CERT_CACHE_TTL_MS,
    });
  }
  return certs;
}

async function fetchCerts(teamName: string): Promise<CachedCert[]> {
  const now = Date.now();
  if (
    certCacheTeam === teamName &&
    certCache.length > 0 &&
    now - certCacheFetchedAt < CERT_CACHE_TTL_MS
  ) {
    return certCache;
  }
  const url = `https://${teamName}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`拉取 Access 证书失败: HTTP ${res.status} (${url})`);
  const body = (await res.json()) as AccessCertsBody;
  const certs = await parseAccessCertsBody(body);
  if (certs.length === 0) {
    throw new Error(
      `Access 证书列表为空 (${url}) — 请确认 tunnel.team_name 为 Zero Trust team 名称`,
    );
  }
  certCache = certs;
  certCacheTeam = teamName;
  certCacheFetchedAt = now;
  return certs;
}

async function verifyToken(
  token: string,
  config: AccessJwtConfig,
): Promise<{ ok: true; email: string } | { ok: false; reason: string }> {
  const parsed = parseJwtParts(token);
  if (!parsed) return { ok: false, reason: "JWT 格式无效" };

  const kid = typeof parsed.header.kid === "string" ? parsed.header.kid : "";
  const certs = await fetchCerts(config.teamName);
  const cert = certs.find((c) => c.kid === kid);
  if (!cert) return { ok: false, reason: "未知 kid" };

  const sigBytes = new Uint8Array(parsed.sig) as Uint8Array<ArrayBuffer>;
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cert.key,
    sigBytes,
    parsed.signed as Uint8Array<ArrayBuffer>,
  );
  if (!valid) return { ok: false, reason: "签名无效" };

  const exp = typeof parsed.payload.exp === "number" ? parsed.payload.exp : 0;
  if (exp * 1000 < Date.now()) return { ok: false, reason: "JWT 已过期" };

  const aud = parsed.payload.aud;
  const audMatch = aud === config.audience || (Array.isArray(aud) && aud.includes(config.audience));
  if (!audMatch) return { ok: false, reason: "audience 不匹配" };

  const email =
    (typeof parsed.payload.email === "string" ? parsed.payload.email : "") ||
    (typeof parsed.payload.common_name === "string" ? parsed.payload.common_name : "");
  if (!email) return { ok: false, reason: "JWT 无 email" };

  const allowed = config.allowedEmails.map((e) => e.toLowerCase());
  if (!allowed.includes(email.toLowerCase())) {
    return { ok: false, reason: "email 不在允许列表" };
  }

  return { ok: true, email };
}

export function createAccessJwtVerifier(config: AccessJwtConfig): AccessJwtVerifier {
  return {
    async preload() {
      if (!config.enabled) return;
      await fetchCerts(config.teamName);
    },
    async verifyRequest(req, remoteAddress) {
      if (!config.enabled) return null;
      if (isAuthExemptPath(req)) return null;
      if (isLocalDirectConnection(req, remoteAddress)) return null;

      const token = normalizeHeader(req, CF_JWT_HEADER);
      if (!token) {
        return new Response("Unauthorized: missing Cloudflare Access token", { status: 401 });
      }

      try {
        const result = await verifyToken(token, config);
        if (!result.ok) {
          return new Response(`Unauthorized: ${result.reason}`, { status: 401 });
        }
        return null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(`Unauthorized: ${msg}`, { status: 401 });
      }
    },
  };
}

export function accessConfigFromTunnel(
  teamName: string | undefined,
  access: TunnelAccessConfig | undefined,
): AccessJwtConfig | null {
  if (!access?.enabled || !teamName || !access.audience || !access.allowed_emails?.length) {
    return null;
  }
  return {
    teamName,
    audience: access.audience,
    allowedEmails: access.allowed_emails,
    enabled: true,
  };
}

/** 测试用：重置证书缓存 */
export function resetAccessJwtCertCacheForTests(): void {
  certCache = [];
  certCacheTeam = "";
  certCacheFetchedAt = 0;
}
