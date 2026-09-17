import {
  createMemoryHistory,
  RouterProvider,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";

import { getBedroomRouter } from "../app/router.tsx";
import {
  bedroomSubpathToShellPath,
  resolveEmbeddedBedroomBasepath,
  resolveBedroomSubpath,
} from "./bedroom-path.ts";

/** 壳内顶级「卧室」SPA：统一 Anima 切换 + 子模块（与栖息地成对）。 */
export function BedroomShell() {
  const shellPath = useRouterState({ select: (s) => s.location.pathname });
  const shellNavigate = useNavigate();
  const shellPathRef = useRef(shellPath);
  shellPathRef.current = shellPath;

  const bedroomBase = useMemo(() => resolveEmbeddedBedroomBasepath(), []);
  const bedroomSubpath = useMemo(() => resolveBedroomSubpath(shellPath), [shellPath]);

  const router = useMemo(
    () =>
      getBedroomRouter({
        basepath: bedroomBase,
        history: createMemoryHistory({ initialEntries: [bedroomSubpath] }),
      }),
    [bedroomBase],
  );

  useEffect(() => {
    const current = router.state.location.pathname;
    if (current !== bedroomSubpath) {
      void router.navigate({ to: bedroomSubpath });
    }
  }, [bedroomSubpath, router]);

  useEffect(() => {
    return router.subscribe("onResolved", () => {
      const inner = router.state.location.pathname;
      const currentSub = resolveBedroomSubpath(shellPathRef.current);
      if (currentSub === inner) return;
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- as never 类型对齐边界
      void shellNavigate({ to: bedroomSubpathToShellPath(inner) as never });
    });
  }, [router, shellNavigate]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <RouterProvider router={router} />
    </div>
  );
}
