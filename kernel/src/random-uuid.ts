function formatUuidV4(bytes: Uint8Array): string {
  const normalized = bytes;
  normalized[6] = (normalized[6]! & 0x0f) | 0x40;
  normalized[8] = (normalized[8]! & 0x3f) | 0x80;
  const hex = Array.from(normalized, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 浏览器 HTTP（非 Secure Context）下 randomUUID 不可用，回退 getRandomValues */
export function randomUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return formatUuidV4(bytes);
  }
  throw new Error("randomUuid: Web Crypto API unavailable");
}
