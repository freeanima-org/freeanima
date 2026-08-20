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
  installHabitatMethodRegistry,
  isHabitatMethodRegistryInstalled,
} from "@freeanima/shared/habitat-contract/registry/runtime.ts";
import type { HabitatMethodDef } from "@freeanima/shared/habitat-contract";

import { chatMethodDefs } from "@freeanima/features/chat/habitat/method-defs.ts";
import { codingMethodDefs } from "@freeanima/features/coding/habitat/method-defs.ts";
import { companionMethodDefs } from "@freeanima/features/companion/habitat/method-defs.ts";
import { diaryMethodDefs } from "@freeanima/features/diary/habitat/method-defs.ts";
import { noteMethodDefs } from "@freeanima/features/note/habitat/method-defs.ts";
import { calendarMethodDefs } from "@freeanima/features/calendar/habitat/method-defs.ts";
import { emailMethodDefs } from "@freeanima/features/email/habitat/method-defs.ts";
import { mcpMethodDefs } from "@freeanima/features/mcp/habitat/method-defs.ts";
import { notificationMethodDefs } from "@freeanima/features/notification/habitat/method-defs.ts";
import { objectStorageMethodDefs } from "@freeanima/features/object-storage/habitat/method-defs.ts";
import { pomodoroMethodDefs } from "@freeanima/features/pomodoro/habitat/method-defs.ts";
import { shellQuickMethodDefs } from "@freeanima/features/shell-quick/habitat/method-defs.ts";
import { projectMethodDefs } from "@freeanima/features/project/habitat/method-defs.ts";
import { tagMethodDefs } from "@freeanima/features/tag/habitat/method-defs.ts";
import { subagentMethodDefs } from "@freeanima/features/subagent/habitat/method-defs.ts";
import { entityMethodDefs } from "@freeanima/features/entity/habitat/method-defs.ts";
import { taskMethodDefs } from "@freeanima/features/task/habitat/method-defs.ts";
import { vaultMethodDefs } from "@freeanima/features/vault/habitat/method-defs.ts";
import { bookmarkMethodDefs } from "@freeanima/features/bookmark/habitat/method-defs.ts";
import { contactMethodDefs } from "@freeanima/features/contact/habitat/method-defs.ts";

/** 聚合各 feature method-defs（浏览器 client registry；无 handler） */
export const FEATURE_METHOD_DEFS = {
  ...chatMethodDefs,
  ...codingMethodDefs,
  ...taskMethodDefs,
  ...projectMethodDefs,
  ...tagMethodDefs,
  ...subagentMethodDefs,
  ...entityMethodDefs,
  ...vaultMethodDefs,
  ...bookmarkMethodDefs,
  ...contactMethodDefs,
  ...emailMethodDefs,
  ...diaryMethodDefs,
  ...noteMethodDefs,
  ...calendarMethodDefs,
  ...pomodoroMethodDefs,
  ...shellQuickMethodDefs,
  ...notificationMethodDefs,
  ...companionMethodDefs,
  ...objectStorageMethodDefs,
  ...mcpMethodDefs,
} as const;

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

let clientRegistryEnsured = false;

/** 浏览器端安装 Habitat method registry（static + feature defs，不含 handler） */
export function ensureClientHabitatMethodRegistry(): void {
  if (clientRegistryEnsured || isHabitatMethodRegistryInstalled()) return;
  clientRegistryEnsured = true;
  installHabitatMethodRegistry(CLIENT_METHOD_REGISTRY);
}

/** @internal 测试重置 */
export function resetClientHabitatMethodRegistryForTests(): void {
  clientRegistryEnsured = false;
}

/** 带 HabitatMethod 类型推导的 Habitat client（类型 SSOT：portal-sdk client registry） */
export function createTypedHabitatClient(options: HabitatClientOptions) {
  ensureClientHabitatMethodRegistry();
  const client = createFullHabitatClient(options);
  return {
    call<K extends HabitatMethod>(
      method: K,
      payload: HabitatMethodInputs[K],
      opts?: HabitatCallOptions,
    ): Promise<HabitatMethodOutputs[K]> {
      return client.call(method, payload, opts) as Promise<HabitatMethodOutputs[K]>;
    },
    callRaw<K extends HabitatMethod>(
      method: K,
      payload: HabitatMethodInputs[K],
      opts?: HabitatCallRawOptions,
    ): Promise<Response> {
      return client.callRaw(method, payload, opts);
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
