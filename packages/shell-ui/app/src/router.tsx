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

import { ChatApp } from "./chat/load-chat-app.ts";
import { TaskApp } from "./tasks/load-task-app.ts";
import { AdminShell } from "./main/AdminShell.tsx";
import { ModuleShell } from "./main/ModuleShell.tsx";
import { NotificationsPage } from "./notifications/NotificationsPage.tsx";
import { SettingsPage } from "./settings/SettingsPage.tsx";

const rootRoute = createRootRoute({
  component: Outlet,
});

const mainLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "main-layout",
  component: ModuleShell,
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
  component: ChatApp,
});

const tasksRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/tasks",
  component: TaskApp,
});

const notificationsRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/notifications",
  component: NotificationsPage,
});

const adminIndexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/admin",
  beforeLoad: () => {
    throw redirect({ to: "/admin/dashboard" });
  },
});

const adminRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/admin/$",
  component: AdminShell,
});

const settingsRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  mainLayoutRoute.addChildren([
    indexRoute,
    chatRoute,
    tasksRoute,
    notificationsRoute,
    adminIndexRoute,
    adminRoute,
    settingsRoute,
  ]),
]);

function createShellRouterInstance() {
  const native = typeof window !== "undefined" && Boolean(window.satelliteShell?.isNativeShell);
  return createRouter({
    routeTree,
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
