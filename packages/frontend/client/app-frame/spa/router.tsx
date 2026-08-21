import { assertNarrow } from "@freeanima/shared/assert-narrow.ts";
import {
  Outlet,
  RouterProvider,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { useMemo, type ComponentType, type ReactElement } from "react";

import { shouldUseNativeShellNavigation } from "@freeanima/client/portal-sdk/shell-runtime.ts";

import { shellLazyRoute } from "./lazy-route.tsx";
import { loadHabitatShellRoute, loadBedroomShellRoute } from "./features/feature-shell-routes.ts";
import { listShellFeatureRoutes } from "./features/shell-registry.ts";
import { AppFrame } from "./main/AppFrame.tsx";
import { SettingsPage } from "./settings/SettingsPage.tsx";
import { needsHabitatSetup } from "./setup/habitat-setup.ts";
import { resolveShellRouterBasepath } from "./router-basepath.ts";

/** TanStack Router 对 lazy ComponentType<object> 的 RouteComponent 约束过严（Windows tsgo + eOPT） */
function asRouteComponent(component: ComponentType<object>): ComponentType<object> {
  return component;
}

function RootOutlet(): ReactElement {
  return <Outlet />;
}

const rootRoute = createRootRoute({
  component: RootOutlet,
});

const setupAliasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  beforeLoad: () => {
    throw redirect({ to: assertNarrow<never>("/settings") });
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
      throw redirect({ to: assertNarrow<never>("/settings") });
    }
  },
});

const indexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: assertNarrow<never>("/chat") });
  },
});

function createLazyShellRoute(path: string, component: ComponentType<object>) {
  return createRoute(
    assertNarrow<Parameters<typeof createRoute>[0]>({
      getParentRoute: () => mainLayoutRoute,
      path,
      component: asRouteComponent(component),
      // Windows tsgo + exactOptionalPropertyTypes 下 lazy RouteComponent 与 RouteOptions 不兼容
    }),
  );
}

const featureRoutes = listShellFeatureRoutes().map((entry) =>
  createLazyShellRoute(entry.path, shellLazyRoute(entry.load)),
);

const habitatIndexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/habitat",
  beforeLoad: () => {
    throw redirect({ to: assertNarrow<never>("/habitat/dashboard") });
  },
});

const habitatDashboardRoute = createLazyShellRoute("/habitat/dashboard", loadHabitatShellRoute());

const habitatCatchAllRoute = createLazyShellRoute("/habitat/$", loadHabitatShellRoute());

const observerIndexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/observer",
  beforeLoad: () => {
    throw redirect({ to: assertNarrow<never>("/bedroom/self-layer") });
  },
});

const observerCatchAllRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/observer/$",
  beforeLoad: ({ location }) => {
    const next = location.pathname.replace(/\/observer(?=\/|$)/, "/bedroom");
    throw redirect({ to: assertNarrow<never>(next) });
  },
});

const bedroomIndexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/bedroom",
  beforeLoad: () => {
    throw redirect({ to: assertNarrow<never>("/bedroom/self-layer") });
  },
});

const bedroomSelfLayerRoute = createLazyShellRoute("/bedroom/self-layer", loadBedroomShellRoute());

const bedroomCatchAllRoute = createLazyShellRoute("/bedroom/$", loadBedroomShellRoute());

const settingsRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/settings",
  component: SettingsPage,
});

const shareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/share/$shareId",
  component: asRouteComponent(
    shellLazyRoute(() =>
      import("@freeanima/features/chat/ui/spa/ShareView.tsx").then(async (mod) => {
        await import("@freeanima/features/chat/ui/spa/styles.css");
        return { default: mod.ShareView };
      }),
    ),
  ),
});

const routeTree = rootRoute.addChildren([
  setupAliasRoute,
  shareRoute,
  mainLayoutRoute.addChildren([
    indexRoute,
    ...featureRoutes,
    habitatIndexRoute,
    habitatDashboardRoute,
    habitatCatchAllRoute,
    observerIndexRoute,
    observerCatchAllRoute,
    bedroomIndexRoute,
    bedroomSelfLayerRoute,
    bedroomCatchAllRoute,
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
