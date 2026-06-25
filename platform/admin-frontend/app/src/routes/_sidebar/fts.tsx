import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getFtsStatus, getRebuildFtsJobStatus, startRebuildFtsIndex } from "@admin/lib/api.ts";
import { m } from "@admin/lib/i18n.ts";
import { catchWithFallback, logCaughtError } from "@admin/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/fts")({
  loader: () => getFtsStatus().catch(catchWithFallback("fts/getFtsStatus", null)),
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

function phaseLabel(phase: string): string {
  if (phase === "semantic_memory_segmented") return m.admin_fts_semantic_seg();
  if (phase === "messages_segmented") return m.admin_fts_messages_seg();
  if (phase === "semantic_memory_embedding") return m.admin_fts_semantic_emb();
  if (phase === "messages_embedding") return m.admin_fts_messages_emb();
  return phase;
}

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
            <th>{m.admin_common_table()}</th>
            <th>{m.admin_common_capability()}</th>
            <th>FTS</th>
            <th>{m.admin_common_segmented()}</th>
            <th>trgm</th>
            <th>{m.admin_common_embedding()}</th>
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
                  row.capabilities.segmented && m.admin_common_segmented(),
                  row.capabilities.trgm && "trgm",
                  row.capabilities.embedding && m.admin_common_embedding(),
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
        <p className="text-xs text-base-content/50 mt-2 font-sans">* {m.admin_fts_cjk_note()}</p>
      ) : null}
    </div>
  );
}

function RebuildProgress({ job }: { job: FtsRebuildJobStatus }) {
  if (!job.running && !job.error && !job.result) return null;

  const pct = job.total > 0 ? Math.min(100, Math.round((job.current / job.total) * 100)) : 0;
  const label = job.phase ? phaseLabel(job.phase) : m.admin_common_preparing();

  return (
    <section className="card bg-base-200 mb-4">
      <div className="card-body gap-3">
        <h3 className="font-bold text-sm">{m.admin_fts_rebuild_progress()}</h3>
        {job.running ? (
          <>
            <p className="text-sm font-sans">
              {label} · {formatRatio(job.current, job.total)}
              {job.only_missing ? m.admin_common_only_missing() : m.admin_common_full_rebuild()}
            </p>
            <progress className="progress progress-primary w-full" value={pct} max={100} />
            <p className="text-xs text-base-content/50 font-sans">
              {m.admin_common_background_hint()}
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
      logCaughtError("routes/_sidebar/fts", e);
      setError(
        m.admin_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
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
    } catch (err) {
      logCaughtError("fts/pollRebuildJob", err);
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
      logCaughtError("routes/_sidebar/fts", e);
      setError(
        m.admin_common_operation_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">{m.admin_fts_title()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.admin_fts_desc()}</p>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      {job ? <RebuildProgress job={job} /> : null}

      <section className="card bg-base-200 mb-4">
        <div className="card-body gap-3">
          <h3 className="font-bold text-sm">{m.admin_fts_coverage()}</h3>
          {status?.coverage?.tables?.length ? (
            <CoverageTable rows={status.coverage.tables} cjkEnabled={status.enabled} />
          ) : (
            <p className="text-sm text-base-content/50">{m.admin_fts_pg_unavailable()}</p>
          )}
        </div>
      </section>

      <section className="card bg-base-200 mb-4">
        <div className="card-body gap-3">
          <h3 className="font-bold text-sm">{m.admin_common_config()}</h3>
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
            <p className="text-sm text-base-content/50">{m.admin_common_load_failed_short()}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={loading || job?.running === true}
              onClick={() => void onRebuild(true)}
            >
              {job?.running ? m.admin_fts_rebuilding() : m.admin_fts_resume()}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={loading || job?.running === true}
              onClick={() => void onRebuild(false)}
            >
              {m.admin_fts_full_rebuild()}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={loading}
              onClick={() => void reload()}
            >
              {m.admin_fts_refresh_stats()}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
