import type { z } from "zod";

import {
  attachHandlersToDefs,
  type HubRouteHandler,
} from "@freeanima/shared/hub-contract/route.ts";
import { diaryMethodDefs } from "@freeanima/shared/hub-contract/registry/features.ts";

import {
  handleDiaryAppend,
  handleDiaryCreate,
  handleDiaryDelete,
  handleDiaryGet,
  handleDiaryList,
  handleDiaryPatch,
  handleDiarySearch,
} from "../rpc.ts";

export const diaryHubRoutes = attachHandlersToDefs(diaryMethodDefs, {
  "diary.list": handleDiaryList,
  "diary.create": handleDiaryCreate,
  "diary.append": handleDiaryAppend,
  "diary.patch": handleDiaryPatch,
  "diary.delete": handleDiaryDelete,
  "diary.get": handleDiaryGet,
  "diary.search": handleDiarySearch,
} as Record<keyof typeof diaryMethodDefs, HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>>);
