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

const adminIndexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/admin",
  beforeLoad: () => {
    throw redirect({ to: "/admin/dashboard" });
  },
});

const adminDashboardRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/admin/dashboard",
  component: loadConsoleShellRoute(),
});

const adminRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/admin/$",
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
    adminIndexRoute,
    adminDashboardRoute,
    adminRoute,
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
