import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type DevWebHttpsOptions = {
  cert: Buffer;
  key: Buffer;
};

function animaHome(): string {
  return process.env.FREEANIMA_HOME ?? join(homedir(), ".anima");
}

function tlsPaths(): { cert: string; key: string } {
  const home = animaHome();
  return { cert: join(home, "tls", "cert.pem"), key: join(home, "tls", "key.pem") };
}

/** config.yaml http.tls.enabled（轻量解析，避免 Vite 拉全量 bootstrap） */
export function isHttpTlsEnabledInConfigYaml(yamlText: string): boolean {
  // 粗匹配：http: 块内 tls: enabled: true（允许缩进与注释后内容）
  const httpBlock = yamlText.match(/(?:^|\n)http:\s*\n([\s\S]*?)(?=\n[a-zA-Z_]|\n*$)/);
  if (!httpBlock?.[1]) return false;
  const tlsBlock = httpBlock[1].match(/(?:^|\n)\s*tls:\s*\n([\s\S]*?)(?=\n\s*[a-zA-Z_]|\n*$)/);
  if (!tlsBlock?.[1]) {
    return /(?:^|\n)\s*tls:\s*\n\s*enabled:\s*true\b/.test(httpBlock[1]);
  }
  return /(?:^|\n)\s*enabled:\s*true\b/.test(tlsBlock[1]);
}

export function shouldEnableDevWebHttps(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.DEV_HTTPS?.trim();
  // 本地 just dev 默认 HTTP；仅显式 DEV_HTTPS=1|true 才开 Vite HTTPS。
  // 不跟 config.yaml http.tls.enabled（那是生产 Habitat TLS，与源码 Vite 解耦）。
  return flag === "1" || flag === "true";
}

/** 复用 ~/.anima/tls 证书；缺失则返回 null（调用方打日志） */
export function resolveDevWebHttps(
  env: NodeJS.ProcessEnv = process.env,
): DevWebHttpsOptions | null {
  if (!shouldEnableDevWebHttps(env)) return null;
  const { cert, key } = tlsPaths();
  if (!existsSync(cert) || !existsSync(key)) return null;
  return {
    cert: readFileSync(cert),
    key: readFileSync(key),
  };
}

export function readDevWebTokenPlaintext(env: NodeJS.ProcessEnv = process.env): string | null {
  const fromEnv = env.FREEANIMA_DEV_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const path = join(animaHome(), "dev-web.token");
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8").trim();
    return raw || null;
  } catch {
    return null;
  }
}

export const DEFAULT_WEB_DEV_PORT = 5000;
