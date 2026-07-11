import {
  createHubClient,
  type HubCallOptions,
  type HubCallRawOptions,
  type HubClientOptions,
} from "@freeanima/shared/hub-client";
import type {
  HubMethod as StaticHubMethod,
  HubMethodInputs as StaticHubMethodInputs,
} from "@freeanima/shared/hub-contract";
import type { HubMethod, HubMethodInputs, HubMethodOutputs } from "./hub-router.ts";

/** 带 HubMethod 类型推导的 Hub client（类型 SSOT：platform/hub-router） */
export function createTypedHubClient(options: HubClientOptions) {
  const client = createHubClient(options);
  return {
    call<K extends HubMethod>(
      method: K,
      payload: HubMethodInputs[K],
      opts?: HubCallOptions,
    ): Promise<HubMethodOutputs[K]> {
      return client.call(
        method as StaticHubMethod,
        payload as StaticHubMethodInputs[StaticHubMethod],
        opts,
      ) as Promise<HubMethodOutputs[K]>;
    },
    callRaw<K extends HubMethod>(
      method: K,
      payload: HubMethodInputs[K],
      opts?: HubCallRawOptions,
    ): Promise<Response> {
      return client.callRaw(
        method as StaticHubMethod,
        payload as StaticHubMethodInputs[StaticHubMethod],
        opts,
      );
    },
    callViaWs: client.callViaWs.bind(client),
    callViaHttp: client.callViaHttp.bind(client),
  };
}

export type TypedHubClient = ReturnType<typeof createTypedHubClient>;
