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

import { lazyNamedComponent, shellLazyRoute } from "./lazy-route.tsx";
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

const chatRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/chat",
  component: shellLazyRoute(() =>
    import("@freeanima/satellite-chat/app").then(async (mod) => {
      await import("@freeanima/satellite-chat/styles.css");
      return { default: mod.ChatApp };
    }),
  ),
});

const tasksRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/tasks",
  component: shellLazyRoute(
    lazyNamedComponent(() => import("@freeanima/satellite-task/app"), "TaskApp"),
  ),
});

const emailRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/email",
  component: shellLazyRoute(
    lazyNamedComponent(() => import("@freeanima/satellite-email/app"), "EmailApp"),
  ),
});

const diaryRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/diary",
  component: shellLazyRoute(
    lazyNamedComponent(() => import("@freeanima/satellite-diary/app"), "DiaryApp"),
  ),
});

const notificationsRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/notifications",
  component: shellLazyRoute(
    lazyNamedComponent(() => import("@freeanima/satellite-notification/app"), "NotificationApp"),
  ),
});

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
  component: shellLazyRoute(() =>
    import("./main/AdminShell.tsx").then(async (mod) => ({ default: mod.AdminShell })),
  ),
});

const adminRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/admin/$",
  component: shellLazyRoute(() =>
    import("./main/AdminShell.tsx").then(async (mod) => ({ default: mod.AdminShell })),
  ),
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
    chatRoute,
    tasksRoute,
    emailRoute,
    diaryRoute,
    notificationsRoute,
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
