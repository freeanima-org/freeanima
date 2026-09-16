import type { Plugin } from "cordis";

import { bootWorldSubjectsPhase } from "../world-subjects-phase.ts";

const plugin: Plugin.Object = {
  name: "boot-world-subjects",
  inject: ["bootPersistence"],
  apply: async (ctx) => {
    ctx.provide("bootWorldSubjects", await bootWorldSubjectsPhase(ctx.bootPersistence.config));
  },
};

export default plugin;
