import {
  DEFAULT_HABITAT_HTTP_PORT,
  resolveHttpBindHost,
  resolveHttpPort,
} from "@freeanima/host/core/config";
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

/** `anima service` HTTP 端口：CLI `--port` 优先，否则 `http.port`，默认 2658 */
export function resolveServicePort(cliPort?: number): number {
  try {
    return resolveHttpPort(cliPort, loadBootstrapConfig().http, DEFAULT_HABITAT_HTTP_PORT);
  } catch {
    return cliPort != null && cliPort > 0 ? cliPort : DEFAULT_HABITAT_HTTP_PORT;
  }
}
