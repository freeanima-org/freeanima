import type { Plugin } from "cordis";

import type { FeatureContribution } from "./types.ts";

/** A Cordis plugin that carries the feature contribution it provides. */
export type FeaturePluginModule = Plugin.Object & {
  readonly feature: FeatureContribution;
};

/**
 * Wrap a feature contribution into a Cordis plugin.
 *
 * The plugin injects `features`, so it activates as soon as the feature
 * service is available and is disposed with the rest of its plugin tree.
 */
export function createFeaturePlugin(contribution: FeatureContribution): FeaturePluginModule {
  return {
    name: `feature:${contribution.id}`,
    inject: ["features"],
    feature: contribution,
    apply(ctx) {
      ctx.features.provide(contribution);
    },
  };
}
