import type { z } from "zod";

import {
  attachHandlersToDefs,
  type HubRouteHandler,
} from "@freeanima/shared/hub-contract/route.ts";
import { dreamMethodDefs } from "@freeanima/shared/hub-contract/registry/features.ts";

import { handleDreamGet, handleDreamList } from "../rpc.ts";

export const dreamHubRoutes = attachHandlersToDefs(dreamMethodDefs, {
  "dream.list": handleDreamList,
  "dream.get": handleDreamGet,
} as Record<keyof typeof dreamMethodDefs, HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>>);
