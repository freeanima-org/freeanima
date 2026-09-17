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
 * service is available. The contribution is registered through `ctx.effect`,
 * so disposing the plugin (reload / unmount) revokes its handlers.
 */
export function createFeaturePlugin(contribution: FeatureContribution): FeaturePluginModule {
  return {
    name: `feature:${contribution.id}`,
    inject: ["features"],
    feature: contribution,
    apply(ctx) {
      ctx.effect(() => {
        ctx.features.provide(contribution);
        return () => {
          ctx.features.revoke(contribution.id);
        };
      }, `feature(${contribution.id})`);
    },
  };
}
