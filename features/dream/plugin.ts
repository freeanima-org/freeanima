import { handleDreamList, handleDreamGet } from "./hub/rpc.ts";

/** Dream feature plugin — registered by platform at boot. */
export const dreamPlugin = {
  id: "dream",
  shell: {
    routes: [{ path: "/dream", featureId: "dream", navLabel: "Dream" }],
  },
  hub: {
    rpc: {
      "dream.list": handleDreamList,
      "dream.get": handleDreamGet,
    },
  },
} as const;
