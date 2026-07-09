import type { HttpConfig } from "@freeanima/core/config";

let cachedHttp: HttpConfig | undefined;

export function bindBootstrapHttpForProcess(http: HttpConfig | undefined): void {
  cachedHttp = http;
}

export function getBootstrapHttpForProcess(): HttpConfig | undefined {
  return cachedHttp;
}

export function resetBootstrapHttpForTest(): void {
  cachedHttp = undefined;
}
