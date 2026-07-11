import type { z } from "zod";

import {
  attachHandlersToDefs,
  type HubRouteHandler,
} from "@freeanima/shared/hub-contract/route.ts";
import { projectMethodDefs } from "@freeanima/shared/hub-contract/registry/project.ts";

import {
  handleMilestoneCreate,
  handleMilestoneDelete,
  handleMilestoneList,
  handleMilestonePatch,
  handleProjectCreate,
  handleProjectDelete,
  handleProjectGet,
  handleProjectList,
  handleProjectPatch,
  handleProjectfolderCreate,
  handleProjectfolderDelete,
  handleProjectfolderList,
  handleProjectfolderPatch,
} from "../rpc.ts";

export const projectHubRoutes = attachHandlersToDefs(projectMethodDefs, {
  "projectfolder.list": handleProjectfolderList,
  "projectfolder.create": handleProjectfolderCreate,
  "projectfolder.patch": handleProjectfolderPatch,
  "projectfolder.delete": handleProjectfolderDelete,
  "project.list": handleProjectList,
  "project.create": handleProjectCreate,
  "project.get": handleProjectGet,
  "project.patch": handleProjectPatch,
  "project.delete": handleProjectDelete,
  "milestone.list": handleMilestoneList,
  "milestone.create": handleMilestoneCreate,
  "milestone.patch": handleMilestonePatch,
  "milestone.delete": handleMilestoneDelete,
} as Record<keyof typeof projectMethodDefs, HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>>);
