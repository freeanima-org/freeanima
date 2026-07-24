import {
  Outlet,
  RouterProvider,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { useMemo } from "react";

import { shouldUseNativeShellNavigation } from "@freeanima/client/portal-sdk/shell-runtime.ts";

import { shellLazyRoute } from "./lazy-route.tsx";
import { loadHabitatShellRoute } from "./features/feature-shell-routes.ts";
import { listShellFeatureRoutes } from "./features/shell-registry.ts";
import { AppFrame } from "./main/AppFrame.tsx";
import { SettingsPage } from "./settings/SettingsPage.tsx";
import { needsHabitatSetup } from "./setup/habitat-setup.ts";
import { resolveShellRouterBasepath } from "./router-basepath.ts";

const rootRoute = createRootRoute({
  component: Outlet,
});

const setupAliasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  beforeLoad: () => {
    throw redirect({ to: "/settings" as never });
  },
});

function isSettingsPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.endsWith("/settings");
}

const mainLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "main-layout",
  component: AppFrame,
  beforeLoad: ({ location }) => {
    if (needsHabitatSetup() && !isSettingsPath(location.pathname)) {
      throw redirect({ to: "/settings" as never });
    }
  },
});

const indexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/chat" as never });
  },
});

const featureRoutes = listShellFeatureRoutes().map((entry) =>
  createRoute({
    getParentRoute: () => mainLayoutRoute,
    path: entry.path,
    component: shellLazyRoute(entry.load),
  }),
);

const habitatIndexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/habitat",
  beforeLoad: () => {
    throw redirect({ to: "/habitat/dashboard" as never });
  },
});

const habitatDashboardRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/habitat/dashboard",
  component: loadHabitatShellRoute(),
});

const habitatCatchAllRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/habitat/$",
  component: loadHabitatShellRoute(),
});

const settingsRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  setupAliasRoute,
  mainLayoutRoute.addChildren([
    indexRoute,
    ...featureRoutes,
    habitatIndexRoute,
    habitatDashboardRoute,
    habitatCatchAllRoute,
    settingsRoute,
  ]),
]);

function createShellRouterInstance() {
  const nativeHash = shouldUseNativeShellNavigation();
  const basepath = resolveShellRouterBasepath();
  return createRouter({
    routeTree,
    ...(!nativeHash && basepath ? { basepath } : {}),
    ...(nativeHash ? { history: createHashHistory() } : {}),
  });
}

export function getShellRouter() {
  return createShellRouterInstance();
}

export function ShellRouterProvider() {
  const router = useMemo(() => createShellRouterInstance(), []);
  return <RouterProvider router={router} />;
}

export { registerShellFeatureRoutes, listShellFeatureRoutes } from "./features/shell-registry.ts";
export {
  openEntityResource,
  setAnimaUriPrimaryComponentResolver,
} from "./features/open-entity-resource.ts";
export { registerEntityOverlay, getEntityOverlay } from "./features/entity-overlay-registry.ts";
