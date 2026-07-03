import { createMemoryHistory, RouterProvider, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { getRouter } from "../../console/router.tsx";
import { initConsoleLocale } from "../../console/lib/i18n.ts";
import { resolveConsoleSubpath, resolveEmbeddedConsoleBasepath } from "./console-path.ts";
// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "@console/styles.css";

initConsoleLocale();

/** Embedded console SPA inside shell-ui (formerly ConsoleShell). */
export function ConsoleShell() {
  const shellPath = useRouterState({ select: (s) => s.location.pathname });
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

  useEffect(() => {
    const current = router.state.location.pathname;
    if (current !== consoleSubpath) {
      void router.navigate({ to: consoleSubpath });
    }
  }, [consoleSubpath, router]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <RouterProvider router={router} />
    </div>
  );
}
