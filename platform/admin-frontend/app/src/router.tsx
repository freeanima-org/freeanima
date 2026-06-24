import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.ts";

const DEFAULT_STALE_MS = 60_000;
const DEFAULT_GC_MS = 5 * 60_000;

export function getRouter(opts?: { basepath?: string }) {
  return createRouter({
    routeTree,
    basepath: opts?.basepath ?? "/admin",
    scrollRestoration: true,
    defaultStaleTime: DEFAULT_STALE_MS,
    defaultGcTime: DEFAULT_GC_MS,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
