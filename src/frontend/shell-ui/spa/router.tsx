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

import { shellLazyRoute } from "./lazy-route.tsx";
import { loadConsoleShellRoute } from "./features/feature-shell-routes.ts";
import { listShellFeatureRoutes } from "./features/shell-registry.ts";
import { ModuleShell } from "./main/ModuleShell.tsx";
import { SettingsPage } from "./settings/SettingsPage.tsx";
import { HubSetupPage } from "./setup/HubSetupPage.tsx";
import { needsHubSetup } from "./setup/hub-setup.ts";
import { resolveShellRouterBasepath } from "./router-basepath.ts";

const rootRoute = createRootRoute({
  component: Outlet,
});

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  component: HubSetupPage,
});

const mainLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "main-layout",
  component: ModuleShell,
  beforeLoad: () => {
    if (needsHubSetup()) {
      throw redirect({ to: "/setup" });
    }
  },
});

const indexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/chat" });
  },
});

const featureRoutes = listShellFeatureRoutes().map((entry) =>
  createRoute({
    getParentRoute: () => mainLayoutRoute,
    path: entry.path,
    component: shellLazyRoute(entry.load),
  }),
);

const consoleIndexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/console",
  beforeLoad: () => {
    throw redirect({ to: "/console/dashboard" });
  },
});

const consoleDashboardRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/console/dashboard",
  component: loadConsoleShellRoute(),
});

const consoleRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/console/$",
  component: loadConsoleShellRoute(),
});

const settingsRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  setupRoute,
  mainLayoutRoute.addChildren([
    indexRoute,
    ...featureRoutes,
    consoleIndexRoute,
    consoleDashboardRoute,
    consoleRoute,
    settingsRoute,
  ]),
]);

function createShellRouterInstance() {
  const native = typeof window !== "undefined" && Boolean(window.satelliteShell?.isNativeShell);
  const basepath = resolveShellRouterBasepath();
  return createRouter({
    routeTree,
    ...(basepath ? { basepath } : {}),
    ...(native ? { history: createHashHistory() } : {}),
  });
}

export function getShellRouter() {
  return createShellRouterInstance();
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createShellRouterInstance>;
  }
}

export function ShellRouterProvider() {
  const router = useMemo(() => createShellRouterInstance(), []);
  return <RouterProvider router={router} />;
}

export { registerShellFeatureRoutes, listShellFeatureRoutes } from "./features/shell-registry.ts";
