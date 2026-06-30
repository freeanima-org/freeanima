import "@freeanima/satellite-chat/styles.css";
import { ChatApp } from "@freeanima/satellite-chat/app";

import { DiaryApp } from "@freeanima/satellite-diary/app";
import { EmailApp } from "@freeanima/satellite-email/app";
import { NotificationApp } from "@freeanima/satellite-notification/app";
import { TaskApp } from "@freeanima/satellite-task/app";
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

import { AdminShell } from "./main/AdminShell.tsx";
import { ModuleShell } from "./main/ModuleShell.tsx";
import { SettingsPage } from "./settings/SettingsPage.tsx";
import { resolveShellRouterBasepath } from "./router-basepath.ts";

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

const emailRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/email",
  component: EmailApp,
});

const diaryRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/diary",
  component: DiaryApp,
});

const notificationsRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/notifications",
  component: NotificationApp,
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
    emailRoute,
    diaryRoute,
    notificationsRoute,
    adminIndexRoute,
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
