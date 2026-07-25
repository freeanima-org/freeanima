import {
  createTypedHabitatClient,
  type HabitatMethod,
  type HabitatMethodInputs,
  type HabitatMethodOutputs,
} from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import type { RpcClient } from "@freeanima/shared/habitat-rpc";
import { loadSettings } from "./settings.ts";

async function rejectWs(): Promise<RpcClient> {
  throw new Error("Vault 扩展仅使用 HTTP REST，不连接 Habitat WebSocket");
}

export async function getExtHabitatClient() {
  const settings = await loadSettings();
  if (!settings.habitat_url) throw new Error("未配置 Habitat URL");
  if (!settings.auth_token) throw new Error("未配置 API Token");
  return createTypedHabitatClient({
    httpOrigin: settings.habitat_url,
    authToken: settings.auth_token,
    getRpcClient: rejectWs,
    profile: "outpost",
  });
}

export async function vaultCall<K extends HabitatMethod>(
  method: K,
  payload: HabitatMethodInputs[K],
): Promise<HabitatMethodOutputs[K]> {
  const client = await getExtHabitatClient();
  return client.call(method, payload, { transport: "http" });
}
