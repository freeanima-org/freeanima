import { useEffect, useState, useSyncExternalStore } from "react";

import {
  getPortalSubjectIdOverride,
  subscribePortalSubjectIdOverride,
} from "./portal-subject-override.ts";
import { getCachedResolvedWorldContext, loadResolvedWorldContext } from "./world-context.ts";

function readBootUserSubjectId(): number {
  return getCachedResolvedWorldContext()?.user_subject_id ?? 0;
}

/**
 * 当前 portal 操作主体：默认可为唯一 user；卧室等可经 portal-subject-override 切到 agent。
 * 未加载完成且无覆盖时返回 0（调用方应 `if (!subjectId) return` / 禁用查询）。
 */
export function useUserSubjectId(): number {
  const override = useSyncExternalStore(
    subscribePortalSubjectIdOverride,
    getPortalSubjectIdOverride,
    () => null,
  );

  const [userSubjectId, setUserSubjectId] = useState<number>(readBootUserSubjectId);

  useEffect(() => {
    let cancelled = false;
    void loadResolvedWorldContext()
      .then((ctx) => {
        if (!cancelled) setUserSubjectId(ctx.user_subject_id);
      })
      .catch(() => {
        /* Habitat 未连通 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (override != null) return override;
  return userSubjectId;
}
