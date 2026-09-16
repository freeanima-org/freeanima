import type { Plugin } from "cordis";

import { bootConfigSecretsPhase } from "../config-secrets-phase.ts";

const plugin: Plugin.Object = {
  name: "boot-config-secrets",
  inject: ["bootPersistence"],
  apply: async (ctx) => {
    await bootConfigSecretsPhase(ctx.bootPersistence.config);
  },
};

export default plugin;
