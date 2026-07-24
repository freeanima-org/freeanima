import { resolveHttpBindHost } from "@freeanima/host/core/config";
import { loadBootstrapConfig } from "@freeanima/host/platform/config/bootstrap.ts";
import { DEFAULT_BIND_HOST } from "@freeanima/host/platform/bind-hosts.ts";

/** `anima service` 监听地址：CLI `--host` 优先，否则 `http.host` */
export function resolveServiceBindHost(cliHost?: string): string {
  try {
    return resolveHttpBindHost(cliHost, loadBootstrapConfig().http, DEFAULT_BIND_HOST);
  } catch {
    return cliHost?.trim() || DEFAULT_BIND_HOST;
  }
}
