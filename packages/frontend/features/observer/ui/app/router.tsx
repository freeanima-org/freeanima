import { assertNarrow } from "@freeanima/shared/assert-narrow.ts";
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { Spinner } from "@freeanima/ui-kit";

import { ObserverLayout } from "./ObserverLayout.tsx";

function asRouteComponent(component: ComponentType<object>): ComponentType<object> {
  return component;
}

function RouteSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          加载中…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function lazyRoute(load: () => Promise<{ default: ComponentType<object> }>): ComponentType<object> {
  const LazyComp = lazy(load);
  return function LazyRouteComponent() {
    return (
      <RouteSuspense>
        <LazyComp />
      </RouteSuspense>
    );
  };
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "observer-layout",
  component: ObserverLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: assertNarrow<never>("/self-layer") });
  },
});

function child(path: string, load: () => Promise<{ default: ComponentType<object> }>) {
  return createRoute(
    assertNarrow<Parameters<typeof createRoute>[0]>({
      getParentRoute: () => layoutRoute,
      path,
      component: asRouteComponent(lazyRoute(load)),
    }),
  );
}

const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([
    indexRoute,
    child("/self-layer", () => import("./pages/self-layer.tsx")),
    child("/semantic-memory", () => import("./pages/semantic-memory.tsx")),
    child("/temporal-summary", () => import("./pages/temporal-summary.tsx")),
    child("/system-prompt", () => import("./pages/system-prompt.tsx")),
    child("/maintenance", () => import("./pages/maintenance.tsx")),
    child("/diary", () => import("./pages/diary.tsx")),
    child("/note", () => import("./pages/note.tsx")),
    child("/email", () => import("./pages/email.tsx")),
    child("/vault", () => import("./pages/vault.tsx")),
    child("/bookmarks", () => import("./pages/bookmarks.tsx")),
    child("/tasks", () => import("./pages/tasks.tsx")),
    child("/projects", () => import("./pages/projects.tsx")),
    child("/calendar", () => import("./pages/calendar.tsx")),
    child("/entities", () => import("./pages/entities.tsx")),
    child("/notifications", () => import("./pages/notifications.tsx")),
  ]),
]);

const DEFAULT_STALE_MS = 60_000;
const DEFAULT_GC_MS = 5 * 60_000;

export function getObserverRouter(opts?: { basepath?: string; history?: RouterHistory }) {
  return createRouter({
    routeTree,
    basepath: opts?.basepath ?? "/bedroom",
    ...(opts?.history ? { history: opts.history } : {}),
    scrollRestoration: true,
    defaultStaleTime: DEFAULT_STALE_MS,
    defaultGcTime: DEFAULT_GC_MS,
  });
}
