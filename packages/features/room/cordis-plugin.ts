import {
  registerFederationRoomHandlers,
  resetFederationRoomHandlersForTest,
} from "@freeanima/capabilities/federation/room-handlers-port.ts";
import { applyFeatureContribution, createFeaturePlugin } from "@freeanima/core/features/plugin.ts";

import {
  hubHandleRoomAppend,
  hubHandleRoomCatchUp,
  hubHandleRoomCreate,
  hubHandleRoomSnapshot,
  satelliteHandleFederationFrame,
} from "./domain/room-federation-handlers.ts";
import { applyFederatedMessageReplica } from "./domain/room-federation.ts";
import { resolveRoomDomainDeps } from "./habitat/domain-deps.ts";
import { roomHabitatRoutes } from "./habitat/routes/index.ts";

const plugin = createFeaturePlugin({
  id: "room",
  routes: roomHabitatRoutes,
});

/** room feature as a Cordis plugin (ctx.features) + 联邦 handler 端口注册。 */
export default {
  name: `feature:room`,
  inject: ["features"] as const,
  feature: plugin.feature,
  apply(ctx: Parameters<typeof applyFeatureContribution>[0]) {
    applyFeatureContribution(ctx, plugin.feature);
    ctx.effect(() => {
      registerFederationRoomHandlers({
        hubHandleRoomAppend,
        hubHandleRoomCatchUp,
        hubHandleRoomSnapshot,
        hubHandleRoomCreate: (payload) => hubHandleRoomCreate(resolveRoomDomainDeps(), payload),
        satelliteHandleFederationFrame,
        applyFederatedMessageReplica,
      });
      return () => {
        resetFederationRoomHandlersForTest();
      };
    }, "federation-room-handlers");
  },
};
