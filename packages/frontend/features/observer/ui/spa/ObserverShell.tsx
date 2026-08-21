import {
  createMemoryHistory,
  RouterProvider,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";

import { getObserverRouter } from "../app/router.tsx";
import {
  observerSubpathToShellPath,
  resolveEmbeddedObserverBasepath,
  resolveObserverSubpath,
} from "./observer-path.ts";

/** 壳内顶级「卧室」SPA：统一 Anima 切换 + 子模块（与栖息地成对）。 */
export function ObserverShell() {
  const shellPath = useRouterState({ select: (s) => s.location.pathname });
  const shellNavigate = useNavigate();
  const shellPathRef = useRef(shellPath);
  shellPathRef.current = shellPath;

  const observerBase = useMemo(() => resolveEmbeddedObserverBasepath(), []);
  const observerSubpath = useMemo(() => resolveObserverSubpath(shellPath), [shellPath]);

  const router = useMemo(
    () =>
      getObserverRouter({
        basepath: observerBase,
        history: createMemoryHistory({ initialEntries: [observerSubpath] }),
      }),
    [observerBase],
  );

  useEffect(() => {
    const current = router.state.location.pathname;
    if (current !== observerSubpath) {
      void router.navigate({ to: observerSubpath });
    }
  }, [observerSubpath, router]);

  useEffect(() => {
    return router.subscribe("onResolved", () => {
      const inner = router.state.location.pathname;
      const currentSub = resolveObserverSubpath(shellPathRef.current);
      if (currentSub === inner) return;
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- as never 类型对齐边界
      void shellNavigate({ to: observerSubpathToShellPath(inner) as never });
    });
  }, [router, shellNavigate]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <RouterProvider router={router} />
    </div>
  );
}
