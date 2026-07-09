import {
  handleTasklistList,
  handleTasklistCreate,
  handleTasklistPatch,
  handleTasklistDelete,
  handleSmartlistList,
  handleSmartlistCreate,
  handleSmartlistPatch,
  handleSmartlistDelete,
  handleTaskList,
  handleTaskCreate,
  handleTaskPatch,
  handleTaskComplete,
  handleTaskUncomplete,
  handleTaskDelete,
  handleTaskSearch,
} from "./hub/rpc.ts";

/** Task feature plugin — registered by platform at boot. */
export const taskPlugin = {
  id: "task",
  shell: {
    routes: [{ path: "/tasks", featureId: "task", navLabel: "Tasks" }],
  },
  hub: {
    rpc: {
      "tasklist.list": handleTasklistList,
      "tasklist.create": handleTasklistCreate,
      "tasklist.patch": handleTasklistPatch,
      "tasklist.delete": handleTasklistDelete,
      "smartlist.list": handleSmartlistList,
      "smartlist.create": handleSmartlistCreate,
      "smartlist.patch": handleSmartlistPatch,
      "smartlist.delete": handleSmartlistDelete,
      "task.list": handleTaskList,
      "task.create": handleTaskCreate,
      "task.patch": handleTaskPatch,
      "task.complete": handleTaskComplete,
      "task.uncomplete": handleTaskUncomplete,
      "task.delete": handleTaskDelete,
      "task.search": handleTaskSearch,
    },
  },
} as const;
