import {
  createFullHabitatClient,
  type HubCallOptions,
  type HubCallRawOptions,
  type HabitatClientOptions,
} from "@freeanima/shared/habitat-client";
import {
  resolveBundledHabitatClientOptions,
  type BundledHabitatClientOptions,
} from "@freeanima/shared/habitat-client/bundled.ts";
import {
  ensureClientHubMethodRegistry,
  resetClientHubMethodRegistryForTests,
} from "./install-client-method-registry.ts";
import type { HubMethod, HubMethodInputs, HubMethodOutputs } from "./habitat-router.ts";

/** 带 HubMethod 类型推导的 Habitat client（类型 SSOT：platform/habitat/habitat-router） */
export function createTypedHabitatClient(options: HabitatClientOptions) {
  ensureClientHubMethodRegistry();
  const client = createFullHabitatClient(options);
  return {
    call<K extends HubMethod>(
      method: K,
      payload: HubMethodInputs[K],
      opts?: HubCallOptions,
    ): Promise<HubMethodOutputs[K]> {
      return client.call(method, payload as never, opts) as Promise<HubMethodOutputs[K]>;
    },
    callRaw<K extends HubMethod>(
      method: K,
      payload: HubMethodInputs[K],
      opts?: HubCallRawOptions,
    ): Promise<Response> {
      return client.callRaw(method, payload as never, opts);
    },
    callViaWs: client.callViaWs.bind(client),
    callViaHttp: client.callViaHttp.bind(client),
    subscribe: client.subscribe.bind(client),
  };
}

export type TypedHabitatClient = ReturnType<typeof createTypedHabitatClient>;

let typedSatelliteClient: TypedHabitatClient | null = null;
let typedSatelliteKey = "";

/** Satellite UI 用 typed client（与 getSatelliteHabitatClient 共享 shell 解析） */
export function getTypedSatelliteHabitatClient(
  options: BundledHabitatClientOptions = {},
): TypedHabitatClient {
  const resolved = resolveBundledHabitatClientOptions({ profile: "satellite", ...options });
  const key = `${resolved.httpOrigin}\0${resolved.authToken ?? ""}\0satellite`;
  if (typedSatelliteClient && typedSatelliteKey === key) return typedSatelliteClient;
  typedSatelliteClient = createTypedHabitatClient(resolved);
  typedSatelliteKey = key;
  return typedSatelliteClient;
}

/** Habitat UI 用 typed client */
export function getTypedConsoleHabitatClient(
  options: BundledHabitatClientOptions,
): TypedHabitatClient {
  return createTypedHabitatClient(
    resolveBundledHabitatClientOptions({ profile: "habitat", ...options }),
  );
}

/** @deprecated 测试重置 */
export function resetTypedHabitatClientForTests(): void {
  resetClientHubMethodRegistryForTests();
  typedSatelliteClient = null;
  typedSatelliteKey = "";
}
