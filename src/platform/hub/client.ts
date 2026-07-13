import {
  createFullHubClient,
  type HubCallOptions,
  type HubCallRawOptions,
  type HubClientOptions,
} from "@freeanima/shared/hub-client";
import {
  resolveBundledHubClientOptions,
  type BundledHubClientOptions,
} from "@freeanima/shared/hub-client/bundled.ts";
import {
  ensureClientHubMethodRegistry,
  resetClientHubMethodRegistryForTests,
} from "./install-client-method-registry.ts";
import type { HubMethod, HubMethodInputs, HubMethodOutputs } from "./hub-router.ts";

/** 带 HubMethod 类型推导的 Hub client（类型 SSOT：platform/hub-router） */
export function createTypedHubClient(options: HubClientOptions) {
  ensureClientHubMethodRegistry();
  const client = createFullHubClient(options);
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

export type TypedHubClient = ReturnType<typeof createTypedHubClient>;

let typedSatelliteClient: TypedHubClient | null = null;
let typedSatelliteKey = "";

/** Satellite UI 用 typed client（与 getSatelliteHubClient 共享 shell 解析） */
export function getTypedSatelliteHubClient(options: BundledHubClientOptions = {}): TypedHubClient {
  const resolved = resolveBundledHubClientOptions({ profile: "satellite", ...options });
  const key = `${resolved.httpOrigin}\0${resolved.authToken ?? ""}\0satellite`;
  if (typedSatelliteClient && typedSatelliteKey === key) return typedSatelliteClient;
  typedSatelliteClient = createTypedHubClient(resolved);
  typedSatelliteKey = key;
  return typedSatelliteClient;
}

/** Console UI 用 typed client */
export function getTypedConsoleHubClient(options: BundledHubClientOptions): TypedHubClient {
  return createTypedHubClient(resolveBundledHubClientOptions({ profile: "console", ...options }));
}

/** @deprecated 测试重置 */
export function resetTypedHubClientForTests(): void {
  resetClientHubMethodRegistryForTests();
  typedSatelliteClient = null;
  typedSatelliteKey = "";
}
