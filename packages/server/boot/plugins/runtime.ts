import type { Plugin } from "cordis";

import { bootRuntimePhase } from "../runtime-phase.ts";

const plugin: Plugin.Object = {
  name: "boot-runtime",
  inject: ["bootOptions", "bootEngine"],
  apply: async (ctx) => {
    ctx.provide(
      "bootRuntime",
      await bootRuntimePhase(
        ctx.bootEngine,
        ctx.bootOptions.statusHost,
        ctx.bootOptions.port,
        ctx.bootOptions.runtimeRef,
        ctx.bootOptions.acpSessionUpdatedRef,
      ),
    );
  },
};

export default plugin;
