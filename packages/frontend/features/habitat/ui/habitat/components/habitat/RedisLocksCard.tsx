import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent } from "@freeanima/ui-kit";
import { showConfirm, StatusAlert } from "@freeanima/ui-kit/composite";
import {
  deleteRedisLock,
  listRedisLocks,
  type HabitatRedisLockInfo,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

function formatTtlMs(ttlMs: number): string {
  if (ttlMs < 0) return "无过期";
  if (ttlMs < 1000) return "不足 1 秒";
  const sec = Math.ceil(ttlMs / 1000);
  if (sec < 60) return `${sec} 秒`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min < 60) return rem ? `${min} 分 ${rem} 秒` : `${min} 分钟`;
  const hr = Math.floor(min / 60);
  const minRem = min % 60;
  return minRem ? `${hr} 小时 ${minRem} 分` : `${hr} 小时`;
}

/** 数据维护网格：列出并强制清除残留的 Redis 分布式锁 */
export function RedisLocksCard() {
  const [configured, setConfigured] = useState(true);
  const [locks, setLocks] = useState<HabitatRedisLockInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const snapshot = await listRedisLocks();
      setConfigured(snapshot.configured);
      setLocks(snapshot.locks);
    } catch (err) {
      logCaughtError("data-maintenance/redis-locks", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onDelete = useCallback(
    async (lock: HabitatRedisLockInfo) => {
      const confirmed = await showConfirm({
        description: `清除锁「${lock.logicalKey}」？若对应任务仍在跑会被中断。`,
        confirmLabel: "清除",
        variant: "error",
      });
      if (!confirmed) return;
      setDeletingKey(lock.key);
      setError("");
      try {
        await deleteRedisLock(lock.key);
        await refresh();
      } catch (err) {
        logCaughtError("data-maintenance/redis-locks/delete", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDeletingKey(null);
      }
    },
    [refresh],
  );

  return (
    <Card className="h-full sm:col-span-2">
      <CardContent className="flex h-full flex-col gap-3 py-3 px-4">
        <div className="min-h-0 flex-1">
          <h2 className="text-sm font-medium">{"Redis 锁"}</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {"进程异常退出后可能残留，导致维护 / 批任务一直显示「已在运行」。清除后即可重跑。"}
          </p>
        </div>

        {!configured ? (
          <StatusAlert variant="warning">{"未配置 Redis，无分布式锁可列。"}</StatusAlert>
        ) : null}

        {locks.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {locks.map((lock) => (
              <li
                key={lock.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{lock.logicalKey}</p>
                  <p className="text-muted-foreground text-xs">{`剩余 ${formatTtlMs(lock.ttlMs)}`}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  isDisabled={deletingKey != null}
                  onClick={() => void onDelete(lock)}
                >
                  {deletingKey === lock.key ? "清除中…" : "清除"}
                </Button>
              </li>
            ))}
          </ul>
        ) : configured ? (
          <p className="text-muted-foreground text-xs">
            {loading ? "加载中…" : "当前没有持有中的锁。"}
          </p>
        ) : null}

        {error ? <p className="text-destructive text-xs">{error}</p> : null}

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          isDisabled={loading || deletingKey != null}
          onClick={() => void refresh()}
        >
          {loading ? "刷新中…" : "刷新"}
        </Button>
      </CardContent>
    </Card>
  );
}
