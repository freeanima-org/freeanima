import { createMemoryHistory, RouterProvider, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { getRouter } from "@freeanima/admin-frontend/router";
import { initAdminLocale } from "@freeanima/admin-frontend/i18n";
// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "@freeanima/admin-frontend/styles.css";

import { resolveAdminSubpath } from "../admin-subpath.ts";
import { resolveEmbeddedAdminBasepath } from "../router-basepath.ts";

initAdminLocale();

export function AdminShell() {
  const shellPath = useRouterState({ select: (s) => s.location.pathname });
  const adminBase = resolveEmbeddedAdminBasepath();
  const adminSubpath = useMemo(() => resolveAdminSubpath(shellPath), [shellPath]);

  const router = useMemo(
    () =>
      getRouter({
        basepath: adminBase,
        history: createMemoryHistory({ initialEntries: [adminSubpath] }),
      }),
    [adminBase],
  );

  useEffect(() => {
    const current = router.state.location.pathname;
    if (current !== adminSubpath) {
      void router.navigate({ to: adminSubpath });
    }
  }, [adminSubpath, router]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <RouterProvider router={router} />
    </div>
  );
}
