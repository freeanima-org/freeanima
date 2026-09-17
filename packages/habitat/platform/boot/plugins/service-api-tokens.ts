import type { Plugin } from "cordis";

import { bootServiceApiTokensPhase } from "../service-api-tokens-phase.ts";

const plugin: Plugin.Object = {
  name: "boot-service-api-tokens",
  inject: ["bootConfigSecrets", "bootPersistence"],
  apply: async (ctx) => {
    await bootServiceApiTokensPhase(ctx.bootPersistence.config);
    ctx.provide("bootServiceApiTokens", {});
  },
};

export default plugin;
