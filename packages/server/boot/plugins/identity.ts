import type { Plugin } from "cordis";

import { bootIdentityPhase } from "../identity-phase.ts";

const plugin: Plugin.Object = {
  name: "boot-identity",
  inject: ["bootPersistence"],
  apply: async (ctx) => {
    ctx.provide("bootIdentity", await bootIdentityPhase(ctx.bootPersistence.config));
  },
};

export default plugin;
