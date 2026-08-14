import {
  createMemoryHistory,
  RouterProvider,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { getRouter } from "../habitat/router.tsx";
import {
  habitatSubpathToShellPath,
  resolveHabitatSubpath,
  resolveEmbeddedHabitatBasepath,
} from "./habitat-path.ts";
// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "@freeanima/features/habitat/ui/habitat/styles.css";

/** Embedded Habitat SPA inside app-ui. */
export function HabitatShell() {
  const shellPath = useRouterState({ select: (s) => s.location.pathname });
  const shellNavigate = useNavigate();
  const shellPathRef = useRef(shellPath);
  shellPathRef.current = shellPath;

  const habitatBase = useMemo(() => resolveEmbeddedHabitatBasepath(), []);
  const habitatSubpath = useMemo(() => resolveHabitatSubpath(shellPath), [shellPath]);

  const router = useMemo(
    () =>
      getRouter({
        basepath: habitatBase,
        history: createMemoryHistory({ initialEntries: [habitatSubpath] }),
      }),
    [habitatBase],
  );

  // Shell URL → embedded habitat
  useEffect(() => {
    const current = router.state.location.pathname;
    if (current !== habitatSubpath) {
      void router.navigate({ to: habitatSubpath });
    }
  }, [habitatSubpath, router]);

  // Embedded habitat → shell URL (memory history does not update the address bar)
  useEffect(() => {
    return router.subscribe("onResolved", () => {
      const inner = router.state.location.pathname;
      const currentSub = resolveHabitatSubpath(shellPathRef.current);
      if (currentSub === inner) return;
      void shellNavigate({ to: habitatSubpathToShellPath(inner) as never });
    });
  }, [router, shellNavigate]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <RouterProvider router={router} />
    </div>
  );
}
