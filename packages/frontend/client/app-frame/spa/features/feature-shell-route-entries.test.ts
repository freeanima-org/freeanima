import { describe, expect, test } from "bun:test";
import { FEATURE_SHELL_ROUTES } from "@freeanima/shared/feature-catalog";

import {
  buildFeatureShellRouteEntries,
  SHELL_ROUTE_EXCLUSIONS,
} from "./feature-shell-route-entries.ts";
import { FEATURE_ROUTE_LOADERS } from "./feature-route-loaders.ts";

const catalogIds = new Set(FEATURE_SHELL_ROUTES.map((route) => route.featureId));

describe("feature shell route catalog", () => {
  test("every non-excluded catalog feature has a loader", () => {
    const missing = FEATURE_SHELL_ROUTES.map((route) => route.featureId).filter(
      (id) => !SHELL_ROUTE_EXCLUSIONS.has(id) && !FEATURE_ROUTE_LOADERS[id],
    );
    expect(missing).toEqual([]);
  });

  test("every loader maps to a catalog feature", () => {
    const orphans = Object.keys(FEATURE_ROUTE_LOADERS).filter((id) => !catalogIds.has(id));
    expect(orphans).toEqual([]);
  });

  test("builds one entry per non-excluded catalog feature, preserving metadata", () => {
    const entries = buildFeatureShellRouteEntries();
    const expected = FEATURE_SHELL_ROUTES.filter(
      (route) => !SHELL_ROUTE_EXCLUSIONS.has(route.featureId),
    );
    expect(
      entries.map((entry) => ({
        featureId: entry.featureId,
        path: entry.path,
        navLabel: entry.navLabel ?? null,
      })),
    ).toEqual(
      expected.map((route) => ({
        featureId: route.featureId,
        path: route.path,
        navLabel: route.navLabel ?? null,
      })),
    );
  });
});
