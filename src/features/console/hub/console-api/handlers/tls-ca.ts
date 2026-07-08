import { existsSync, readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";

import { DEFAULT_HUB_HTTP_PORT } from "@freeanima/core/config";
import { defaultHubTlsCertPath } from "@freeanima/platform/tls/hub-tls-material";
import {
  detectHubTlsIssuerKind,
  readMkcertRootCaPem,
  type HubTlsIssuerKind,
} from "@freeanima/platform/tls/mkcert-root-ca";
import { expandConfigPath } from "@freeanima/platform/tls/tls-paths";

export type TlsCaInfoResponse = {
  available: boolean;
  kind: HubTlsIssuerKind;
  issuer: string | null;
  download_url: string;
  qr_url: string;
  qr_data_url?: string;
  filename: string;
  install_hint: string;
};

function buildHttpDownloadBase(request: Request, httpPort = DEFAULT_HUB_HTTP_PORT): string {
  const url = new URL(request.url);
  url.protocol = "http:";
  url.port = String(httpPort);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.origin;
}

function readHubCertIssuer(): string | null {
  try {
    const certPath = expandConfigPath(defaultHubTlsCertPath());
    if (!existsSync(certPath)) return null;
    const cert = new X509Certificate(readFileSync(certPath, "utf-8"));
    return cert.issuer || null;
  } catch {
    return null;
  }
}

async function buildQrDataUrl(text: string, size = 256): Promise<string | undefined> {
  try {
    const QRCode = await import("qrcode");
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch {
    return undefined;
  }
}

export async function getTlsCaInfo(request: Request): Promise<TlsCaInfoResponse> {
  const kind = detectHubTlsIssuerKind();
  const issuer = readHubCertIssuer();
  const httpBase = buildHttpDownloadBase(request);
  const downloadUrl = `${httpBase}/api/tls/ca`;
  const qrUrl = `${httpBase}/api/tls/ca/qr?size=256`;

  if (kind === "mkcert" && readMkcertRootCaPem()) {
    const qr_data_url = await buildQrDataUrl(downloadUrl);
    return {
      available: true,
      kind,
      issuer,
      download_url: downloadUrl,
      qr_url: qrUrl,
      ...(qr_data_url ? { qr_data_url } : {}),
      filename: "rootCA.pem",
      install_hint:
        "在手机/其他设备上安装此 mkcert 根 CA 后，再访问 HTTPS 端口即可消除证书警告与脚本加载错误。iOS 还需在「证书信任设置」中启用完全信任。",
    };
  }

  return {
    available: false,
    kind,
    issuer,
    download_url: downloadUrl,
    qr_url: qrUrl,
    filename: "rootCA.pem",
    install_hint:
      kind === "self-signed"
        ? "当前 Hub 使用 openssl 自签证书，无独立根 CA 可分发。请安装 mkcert 并重签，或改用 HTTP 端口访问。"
        : "Hub 尚未配置 TLS 证书。",
  };
}

export function getTlsCaPemResponse(): Response | null {
  const pem = readMkcertRootCaPem();
  if (!pem) return null;
  return new Response(pem, {
    status: 200,
    headers: {
      "Content-Type": "application/x-pem-file; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rootCA.pem"',
      "Cache-Control": "no-store",
    },
  });
}

export async function getTlsCaQrResponse(request: Request): Promise<Response | null> {
  const info = await getTlsCaInfo(request);
  if (!info.available) return null;

  const url = new URL(request.url);
  const sizeRaw = url.searchParams.get("size");
  const size = Math.min(512, Math.max(128, Number(sizeRaw) || 256));

  try {
    const QRCode = await import("qrcode");
    const png = await QRCode.toBuffer(info.download_url, {
      type: "png",
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return null;
  }
}
