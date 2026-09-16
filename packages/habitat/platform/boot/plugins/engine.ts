import type { Plugin } from "cordis";

import { bootEnginePhase } from "../engine-phase.ts";

const plugin: Plugin.Object = {
  name: "boot-engine",
  inject: ["bootOptions", "bootPersistence"],
  apply: async (ctx) => {
    ctx.provide(
      "bootEngine",
      await bootEnginePhase(ctx.bootPersistence.config, ctx.bootOptions.onConversationUpdated),
    );
  },
};

export default plugin;
