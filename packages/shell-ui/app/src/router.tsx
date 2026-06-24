import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { loadChatApp } from "./chat/load-chat-app.ts";

import { AdminShell } from "./main/AdminShell.tsx";
import { ModuleShell } from "./main/ModuleShell.tsx";
import { SettingsPage } from "./settings/SettingsPage.tsx";

const ChatApp = lazy(() => loadChatApp());

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
  component: ChatRoute,
});

const adminRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: "/admin/$",
  component: AdminShell,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  mainLayoutRoute.addChildren([indexRoute, chatRoute, adminRoute]),
  settingsRoute,
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

function ChatRoute() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-base-content/60">加载会客厅…</p>}>
      <ChatApp />
    </Suspense>
  );
}
