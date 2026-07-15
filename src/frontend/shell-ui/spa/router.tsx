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

import {
  isCapacitorNativePlatform,
  isMobileCapacitorShellCandidate,
} from "@freeanima/frontend/shell-sdk/capacitor-runtime.ts";

import { shellLazyRoute } from "./lazy-route.tsx";
import { loadConsoleShellRoute } from "./features/feature-shell-routes.ts";
import { listShellFeatureRoutes } from "./features/shell-registry.ts";
import { ModuleShell } from "./main/ModuleShell.tsx";
import { SettingsPage } from "./settings/SettingsPage.tsx";
import { needsHubSetup } from "./setup/hub-setup.ts";
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
  component: ModuleShell,
  beforeLoad: ({ location }) => {
    if (needsHubSetup() && !isSettingsPath(location.pathname)) {
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

const consoleIndexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/console",
  beforeLoad: () => {
    throw redirect({ to: "/console/dashboard" as never });
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
  setupAliasRoute,
  mainLayoutRoute.addChildren([
    indexRoute,
    ...featureRoutes,
    consoleIndexRoute,
    consoleDashboardRoute,
    consoleRoute,
    settingsRoute,
  ]),
]);

/** Capacitor：用 hash 路由（无 SPA fallback）；document 已在 /web/，勿再叠 basepath */
function shouldUseNativeHashHistory(): boolean {
  if (typeof window === "undefined") return false;
  if (window.satelliteShell?.isNativeShell) return true;
  // 仅真壳 / 薄壳候选；手机浏览器直连 Hub 走 path 路由
  return isCapacitorNativePlatform() || isMobileCapacitorShellCandidate();
}

function createShellRouterInstance() {
  const nativeHash = shouldUseNativeHashHistory();
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
