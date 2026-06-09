import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getFtsStatus, getRebuildFtsJobStatus, startRebuildFtsIndex } from "@/lib/api.ts";

export const Route = createFileRoute("/chamber/fts")({
  loader: () => getFtsStatus().catch(() => null),
  component: FtsPage,
});

type FtsTableCapabilities = {
  fts: boolean;
  segmented: boolean;
  trgm: boolean;
  embedding: boolean;
};

type FtsTableCoverageRow = {
  table: string;
  label: string;
  capabilities: FtsTableCapabilities;
  total: number;
  fts: number;
  segmented: number;
  embedding: number;
};

type FtsRebuildJobStatus = {
  running: boolean;
  phase: string | null;
  table: string | null;
  current: number;
  total: number;
  only_missing: boolean;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  result: unknown;
};

type FtsStatus = {
  enabled: boolean;
  dict_path: string;
  dict_exists: boolean;
  embedding: {
    enabled: boolean;
    model: string | null;
    base_url: string | null;
    dimensions: number;
  };
  coverage: { tables: FtsTableCoverageRow[] } | null;
  rebuild?: FtsRebuildJobStatus;
};

const PHASE_LABEL: Record<string, string> = {
  semantic_memory_segmented: "语义记忆 · 分词",
  messages_segmented: "对话消息 · 分词",
  semantic_memory_embedding: "语义记忆 · 向量",
  messages_embedding: "对话消息 · 向量",
};

function formatRatio(n: number, total: number): string {
  return `${n}/${total}`;
}

function capabilityCell(enabled: boolean): string {
  return enabled ? "✓" : "—";
}

function CoverageTable({ rows, cjkEnabled }: { rows: FtsTableCoverageRow[]; cjkEnabled: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm font-mono text-xs">
        <thead>
          <tr>
            <th>表</th>
            <th>能力</th>
            <th>FTS</th>
            <th>分词</th>
            <th>trgm</th>
            <th>向量</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.table}>
              <td>
                <div className="font-sans font-medium">{row.label}</div>
                <div className="text-base-content/50">{row.table}</div>
              </td>
              <td className="text-base-content/60 whitespace-nowrap">
                {[
                  row.capabilities.fts && "FTS",
                  row.capabilities.segmented && "分词",
                  row.capabilities.trgm && "trgm",
                  row.capabilities.embedding && "向量",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </td>
              <td>{row.capabilities.fts ? formatRatio(row.fts, row.total) : "—"}</td>
              <td>
                {row.capabilities.segmented
                  ? cjkEnabled
                    ? formatRatio(row.segmented, row.total)
                    : `${formatRatio(row.segmented, row.total)}*`
                  : "—"}
              </td>
              <td>{row.capabilities.trgm ? capabilityCell(true) : "—"}</td>
              <td>{row.capabilities.embedding ? formatRatio(row.embedding, row.total) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!cjkEnabled ? (
        <p className="text-xs text-base-content/50 mt-2 font-sans">
          * <code className="font-mono">cjk.enabled</code> 关闭时{" "}
          <code className="font-mono">fts_segmented</code> 为空属正常；开启后需重建分词。
        </p>
      ) : null}
    </div>
  );
}

function RebuildProgress({ job }: { job: FtsRebuildJobStatus }) {
  if (!job.running && !job.error && !job.result) return null;

  const pct = job.total > 0 ? Math.min(100, Math.round((job.current / job.total) * 100)) : 0;
  const phaseLabel = job.phase ? (PHASE_LABEL[job.phase] ?? job.phase) : "准备中";

  return (
    <section className="card bg-base-200 mb-4">
      <div className="card-body gap-3">
        <h3 className="font-bold text-sm">重建进度</h3>
        {job.running ? (
          <>
            <p className="text-sm font-sans">
              {phaseLabel} · {formatRatio(job.current, job.total)}
              {job.only_missing ? "（仅补缺失）" : "（全量）"}
            </p>
            <progress className="progress progress-primary w-full" value={pct} max={100} />
            <p className="text-xs text-base-content/50 font-sans">
              后台运行中，可关闭页面；刷新统计可查看覆盖度变化。
            </p>
          </>
        ) : null}
        {job.error ? <div className="alert alert-error text-sm">{job.error}</div> : null}
        {job.result ? (
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(job.result, null, 2)}
          </pre>
        ) : null}
      </div>
    </section>
  );
}

function FtsPage() {
  const initial = Route.useLoaderData() as FtsStatus | null;
  const [status, setStatus] = useState<FtsStatus | null>(initial);
  const [job, setJob] = useState<FtsRebuildJobStatus | null>(initial?.rebuild ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(async () => {
    setError("");
    try {
      const data = (await getFtsStatus()) as FtsStatus;
      setStatus(data);
      if (data.rebuild) setJob(data.rebuild);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const pollJob = useCallback(async () => {
    try {
      const next = (await getRebuildFtsJobStatus()) as FtsRebuildJobStatus;
      setJob(next);
      if (!next.running) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        await reload();
      }
    } catch {
      /* 轮询失败忽略 */
    }
  }, [reload]);

  useEffect(() => {
    if (job?.running && !pollRef.current) {
      pollRef.current = setInterval(() => void pollJob(), 2000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [job?.running, pollJob]);

  const onRebuild = async (onlyMissing: boolean) => {
    setLoading(true);
    setError("");
    try {
      const started = (await startRebuildFtsIndex({
        only_missing: onlyMissing,
      })) as FtsRebuildJobStatus;
      setJob(started);
      if (started.running && !pollRef.current) {
        pollRef.current = setInterval(() => void pollJob(), 2000);
      }
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
        重建在<strong>后台</strong>执行，不会阻塞页面。默认<strong>仅补缺失</strong>
        行，可断点续跑（如向量 68/13571 中断后再次点击即可继续）。
      </p>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      {job ? <RebuildProgress job={job} /> : null}

      <section className="card bg-base-200 mb-4">
        <div className="card-body gap-3">
          <h3 className="font-bold text-sm">索引覆盖度</h3>
          {status?.coverage?.tables?.length ? (
            <CoverageTable rows={status.coverage.tables} cjkEnabled={status.enabled} />
          ) : (
            <p className="text-sm text-base-content/50">无法读取 PG 统计（未连接或非 PG 主存）</p>
          )}
        </div>
      </section>

      <section className="card bg-base-200 mb-4">
        <div className="card-body gap-3">
          <h3 className="font-bold text-sm">配置</h3>
          {status ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm font-mono">
              <dt className="text-base-content/60">cjk.enabled</dt>
              <dd>{status.enabled ? "true" : "false"}</dd>
              <dt className="text-base-content/60">dict_path</dt>
              <dd className="break-all">{status.dict_path}</dd>
              <dt className="text-base-content/60">dict_exists</dt>
              <dd>{status.dict_exists ? "true" : "false"}</dd>
              <dt className="text-base-content/60">embedding.enabled</dt>
              <dd>{status.embedding.enabled ? "true" : "false"}</dd>
              <dt className="text-base-content/60">embedding.model</dt>
              <dd>{status.embedding.model ?? "—"}</dd>
              <dt className="text-base-content/60">embedding.base_url</dt>
              <dd className="break-all">{status.embedding.base_url ?? "—"}</dd>
            </dl>
          ) : (
            <p className="text-sm text-base-content/50">加载失败</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={loading || job?.running === true}
              onClick={() => void onRebuild(true)}
            >
              {job?.running ? "重建中…" : "续跑 / 补缺失"}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={loading || job?.running === true}
              onClick={() => void onRebuild(false)}
            >
              全量重建
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={loading}
              onClick={() => void reload()}
            >
              刷新统计
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
