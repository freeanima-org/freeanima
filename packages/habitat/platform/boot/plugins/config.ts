import type { Plugin } from "cordis";

import { bootConfigPhase } from "../config-phase.ts";

const plugin: Plugin.Object = {
  name: "boot-config",
  apply: async (ctx) => {
    await bootConfigPhase();
    ctx.provide("bootConfig", {});
  },
};

export default plugin;
