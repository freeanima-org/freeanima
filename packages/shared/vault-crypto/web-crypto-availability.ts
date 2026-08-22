/** User 库解锁依赖 `crypto.subtle`（PBKDF2 / AES-GCM），仅 Secure Context 可用。 */

export function isVaultWebCryptoAvailable(
  cryptoApi: Crypto | undefined | null = globalThis.crypto,
): boolean {
  return cryptoApi?.subtle != null;
}

/**
 * 局域网 HTTP（非 localhost）时建议的栖息地 HTTPS 入口。
 * 仅当当前为 :2658（或默认 HTTP 无端口）时改写为 :2659；其它端口返回 null。
 */
export function suggestHabitatHttpsUnlockUrl(pageHref: string): string | null {
  try {
    const url = new URL(pageHref);
    if (url.protocol !== "http:") return null;
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return null;
    const port = url.port;
    if (port !== "" && port !== "2658") return null;
    url.protocol = "https:";
    url.port = "2659";
    return url.toString();
  } catch {
    return null;
  }
}

export function vaultWebCryptoUnavailableMessage(opts?: { pageHref?: string }): string {
  const base =
    "当前页面非安全上下文，浏览器禁用了 Web Crypto，无法解锁用户保险库。请改用 HTTPS，或本机用 http://127.0.0.1 / localhost 打开。";
  const href = opts?.pageHref?.trim();
  if (!href) return `${base}局域网栖息地默认 HTTPS 端口为 2659。`;
  const suggested = suggestHabitatHttpsUnlockUrl(href);
  if (suggested) return `${base}可改开：${suggested}`;
  return `${base}局域网栖息地默认 HTTPS 端口为 2659。`;
}
