import { z } from "zod";

import {
  createFullHabitatClient,
  type HabitatCallOptions,
  type HabitatCallRawOptions,
  type HabitatClientOptions,
} from "@freeanima/shared/habitat-client";
import {
  resolveBundledHabitatClientOptions,
  type BundledHabitatClientOptions,
} from "@freeanima/shared/habitat-client/bundled-browser.ts";
import { STATIC_METHOD_REGISTRY } from "@freeanima/shared/habitat-contract/registry/index.ts";
import {
  ensureFullHabitatMethodRegistry,
  resetFullHabitatMethodRegistryForTests,
} from "@freeanima/shared/habitat-contract/registry/full.ts";
import type { HabitatMethodDef } from "@freeanima/shared/habitat-contract";
import { FEATURE_METHOD_DEFS } from "@freeanima/shared/rpc-contract/feature-rpc";

export { FEATURE_METHOD_DEFS };

const CLIENT_METHOD_REGISTRY = {
  ...STATIC_METHOD_REGISTRY,
  ...FEATURE_METHOD_DEFS,
} as const satisfies Record<string, HabitatMethodDef>;

type ClientMethodRegistry = typeof CLIENT_METHOD_REGISTRY;

export type HabitatMethod = keyof ClientMethodRegistry;
export type HabitatMethodInputs = {
  [K in HabitatMethod]: z.infer<ClientMethodRegistry[K]["input"]>;
};
export type HabitatMethodOutputs = {
  [K in HabitatMethod]: z.infer<ClientMethodRegistry[K]["output"]>;
};

/** 浏览器端安装 Habitat method registry（static + feature defs，不含 handler） */
export function ensureClientHabitatMethodRegistry(): void {
  ensureFullHabitatMethodRegistry();
}

/** @internal 测试重置 */
export function resetClientHabitatMethodRegistryForTests(): void {
  resetFullHabitatMethodRegistryForTests();
}

/** 带 HabitatMethod 类型推导的 Habitat client（类型 SSOT：portal-sdk client registry） */
export function createTypedHabitatClient(options: HabitatClientOptions) {
  ensureClientHabitatMethodRegistry();
  const client = createFullHabitatClient(options);
  return {
    async call<K extends HabitatMethod>(
      method: K,
      payload: HabitatMethodInputs[K],
      opts?: HabitatCallOptions,
    ): Promise<HabitatMethodOutputs[K]> {
      // FullHabitatClient.call 已 output.parse；再经 portal-sdk registry 对齐本地 HabitatMethodOutputs
      const raw = await client.call(method, payload, opts);
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Zod.parse 对泛型 K 无法收窄到 HabitatMethodOutputs[K]
      return CLIENT_METHOD_REGISTRY[method].output.parse(raw) as HabitatMethodOutputs[K];
    },
    callRaw<K extends HabitatMethod>(
      method: K,
      payload: HabitatMethodInputs[K],
      opts?: HabitatCallRawOptions,
    ): Promise<Response> {
      return client.callRaw(method, payload, opts);
    },
    /** outbox 等动态 method 名：绕过 HabitatMethod 字面量联合 */
    callByName(method: string, payload: unknown, opts?: HabitatCallOptions): Promise<unknown> {
      return client.call(method, payload, opts);
    },
    callViaWs: client.callViaWs.bind(client),
    callViaHttp: client.callViaHttp.bind(client),
    subscribe: client.subscribe.bind(client),
  };
}

export type TypedHabitatClient = ReturnType<typeof createTypedHabitatClient>;

let typedOutpostClient: TypedHabitatClient | null = null;
let typedOutpostKey = "";

/** Outpost/Portal UI 用 typed client */
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
