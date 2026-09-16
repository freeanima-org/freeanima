import type { Plugin } from "cordis";

import { bootPersistencePhase } from "../persistence-phase.ts";

const plugin: Plugin.Object = {
  name: "boot-persistence",
  apply: async (ctx) => {
    ctx.provide("bootPersistence", await bootPersistencePhase());
  },
};

export default plugin;
