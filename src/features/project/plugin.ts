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
} from "./hub/rpc.ts";

/** Project feature plugin — registered by platform at boot. */
export const projectPlugin = {
  id: "project",
  shell: {
    routes: [{ path: "/projects", featureId: "project", navLabel: "Projects" }],
  },
  hub: {
    rpc: {
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
    },
  },
} as const;
