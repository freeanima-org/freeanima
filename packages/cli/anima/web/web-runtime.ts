import { apiGet, resolveProbeHost } from "../service-common.ts";

/** Probe Habitat-hosted `/web/healthz` on the same host:port as the API. */
export async function probeWebHealth(host: string, port: number): Promise<boolean> {
  const probeHost = resolveProbeHost(host);
  const health = await apiGet(probeHost, port, "/web/healthz", 2000);
  return health?.ok === true;
}
