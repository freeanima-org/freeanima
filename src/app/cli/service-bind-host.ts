import { resolveHttpBindHost } from "@freeanima/core/config";
import { FileConfig } from "@freeanima/platform/config";
import { DEFAULT_BIND_HOST } from "@freeanima/platform/bind-hosts";

/** `anima service` 监听地址：CLI `--host` 优先，否则 `http.host` */
export function resolveServiceBindHost(cliHost?: string): string {
  try {
    return resolveHttpBindHost(cliHost, FileConfig.open().data.http, DEFAULT_BIND_HOST);
  } catch {
    return cliHost?.trim() || DEFAULT_BIND_HOST;
  }
}
