import {
  createFullHabitatClient,
  type HabitatCallOptions,
  type HabitatCallRawOptions,
  type HabitatClientOptions,
} from "@freeanima/shared/habitat-client";
import {
  resolveBundledHabitatClientOptions,
  type BundledHabitatClientOptions,
} from "@freeanima/shared/habitat-client/bundled.ts";
import {
  ensureClientHabitatMethodRegistry,
  resetClientHabitatMethodRegistryForTests,
} from "./install-client-method-registry.ts";
import type { HabitatMethod, HabitatMethodInputs, HabitatMethodOutputs } from "./habitat-router.ts";

/** 带 HabitatMethod 类型推导的 Habitat client（类型 SSOT：platform/habitat/habitat-router） */
export function createTypedHabitatClient(options: HabitatClientOptions) {
  ensureClientHabitatMethodRegistry();
  const client = createFullHabitatClient(options);
  return {
    call<K extends HabitatMethod>(
      method: K,
      payload: HabitatMethodInputs[K],
      opts?: HabitatCallOptions,
    ): Promise<HabitatMethodOutputs[K]> {
      return client.call(method, payload as never, opts) as Promise<HabitatMethodOutputs[K]>;
    },
    callRaw<K extends HabitatMethod>(
      method: K,
      payload: HabitatMethodInputs[K],
      opts?: HabitatCallRawOptions,
    ): Promise<Response> {
      return client.callRaw(method, payload as never, opts);
    },
    callViaWs: client.callViaWs.bind(client),
    callViaHttp: client.callViaHttp.bind(client),
    subscribe: client.subscribe.bind(client),
  };
}

export type TypedHabitatClient = ReturnType<typeof createTypedHabitatClient>;

let typedOutpostClient: TypedHabitatClient | null = null;
let typedOutpostKey = "";

/** Outpost/Portal UI 用 typed client（与 getOutpostHabitatClient 共享 shell 解析） */
export function getTypedHabitatClient(
  options: BundledHabitatClientOptions = {},
): TypedHabitatClient {
  const resolved = resolveBundledHabitatClientOptions({ profile: "outpost", ...options });
  const key = `${resolved.httpOrigin}\0${resolved.authToken ?? ""}\0outpost`;
  if (typedOutpostClient && typedOutpostKey === key) return typedOutpostClient;
  typedOutpostClient = createTypedHabitatClient(resolved);
  typedOutpostKey = key;
  return typedOutpostClient;
}

/** Habitat UI 用 typed client */
export function getTypedHabitatUiClient(options: BundledHabitatClientOptions): TypedHabitatClient {
  return createTypedHabitatClient(
    resolveBundledHabitatClientOptions({ profile: "habitat", ...options }),
  );
}

/** 测试重置 typed Habitat client */
export function resetTypedHabitatClientForTests(): void {
  resetClientHabitatMethodRegistryForTests();
  typedOutpostClient = null;
  typedOutpostKey = "";
}
