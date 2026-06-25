import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

import { ChatApp } from "./chat/load-chat-app.ts";
import { AdminShell } from "./main/AdminShell.tsx";
import { ModuleShell } from "./main/ModuleShell.tsx";
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
  mainLayoutRoute.addChildren([indexRoute, chatRoute, adminIndexRoute, adminRoute, settingsRoute]),
]);

export function getShellRouter() {
  return createRouter({ routeTree });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getShellRouter>;
  }
}

export function ShellRouterProvider() {
  const router = getShellRouter();
  return <RouterProvider router={router} />;
}
