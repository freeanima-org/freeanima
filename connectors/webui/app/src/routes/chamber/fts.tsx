import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getFtsStatus, rebuildFtsIndex } from "@/lib/api.ts";

export const Route = createFileRoute("/chamber/fts")({
  loader: () => getFtsStatus().catch(() => null),
  component: FtsPage,
});

type FtsStatus = {
  enabled: boolean;
  dict_path: string;
  dict_exists: boolean;
};

type RebuildResult = {
  tables: { semantic_memory: number; messages: number };
  cjk_enabled: boolean;
};

function FtsPage() {
  const initial = Route.useLoaderData() as FtsStatus | null;
  const [status, setStatus] = useState<FtsStatus | null>(initial);
  const [result, setResult] = useState<RebuildResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    setError("");
    try {
      setStatus((await getFtsStatus()) as FtsStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onRebuild = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await rebuildFtsIndex();
      setResult(data as RebuildResult);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">🔍 全文检索</h2>
      <p className="text-sm text-base-content/60 mb-4">
        修改 <code className="font-mono">cjk.enabled</code> 或用户词典后，点击重建以刷新存量
        <code className="font-mono"> fts_segmented</code> 与生成列{" "}
        <code className="font-mono">content_fts</code>。
      </p>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      <section className="card bg-base-200 mb-4">
        <div className="card-body gap-3">
          <h3 className="font-bold text-sm">CJK 分词</h3>
          {status ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm font-mono">
              <dt className="text-base-content/60">enabled</dt>
              <dd>{status.enabled ? "true" : "false"}</dd>
              <dt className="text-base-content/60">dict_path</dt>
              <dd className="break-all">{status.dict_path}</dd>
              <dt className="text-base-content/60">dict_exists</dt>
              <dd>{status.dict_exists ? "true" : "false"}</dd>
            </dl>
          ) : (
            <p className="text-sm text-base-content/50">加载失败</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={loading}
              onClick={onRebuild}
            >
              {loading ? "重建中…" : "重建 FTS 索引"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={loading}
              onClick={reload}
            >
              刷新状态
            </button>
          </div>
        </div>
      </section>

      {result ? (
        <section className="card bg-base-200">
          <div className="card-body gap-2">
            <h3 className="font-bold text-sm">上次重建</h3>
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </section>
      ) : null}
    </div>
  );
}
