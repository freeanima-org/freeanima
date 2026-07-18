import {
  createMemoryHistory,
  RouterProvider,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { getRouter } from "../console/router.tsx";
import { initConsoleLocale } from "../console/lib/i18n.ts";
import {
  consoleSubpathToShellPath,
  resolveConsoleSubpath,
  resolveEmbeddedConsoleBasepath,
} from "./console-path.ts";
// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "@freeanima/features/console/ui/console/styles.css";

initConsoleLocale();

/** Embedded console SPA inside shell-ui (formerly ConsoleShell). */
export function ConsoleShell() {
  const shellPath = useRouterState({ select: (s) => s.location.pathname });
  const shellNavigate = useNavigate();
  const shellPathRef = useRef(shellPath);
  shellPathRef.current = shellPath;

  const consoleBase = useMemo(() => resolveEmbeddedConsoleBasepath(), []);
  const consoleSubpath = useMemo(() => resolveConsoleSubpath(shellPath), [shellPath]);

  const router = useMemo(
    () =>
      getRouter({
        basepath: consoleBase,
        history: createMemoryHistory({ initialEntries: [consoleSubpath] }),
      }),
    [consoleBase],
  );

  // Shell URL → embedded console
  useEffect(() => {
    const current = router.state.location.pathname;
    if (current !== consoleSubpath) {
      void router.navigate({ to: consoleSubpath });
    }
  }, [consoleSubpath, router]);

  // Embedded console → shell URL (memory history does not update the address bar)
  useEffect(() => {
    return router.subscribe("onResolved", () => {
      const inner = router.state.location.pathname;
      const currentSub = resolveConsoleSubpath(shellPathRef.current);
      if (currentSub === inner) return;
      void shellNavigate({ to: consoleSubpathToShellPath(inner) as never });
    });
  }, [router, shellNavigate]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <RouterProvider router={router} />
    </div>
  );
}
