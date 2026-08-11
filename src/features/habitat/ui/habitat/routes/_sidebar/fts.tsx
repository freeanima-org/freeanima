import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import {
  getFtsStatus,
  getRebuildFtsJobStatus,
  startRebuildFtsIndex,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
import {
  catchWithFallback,
  logCaughtError,
} from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

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
  if (phase === "semantic_memory_segmented") return m.habitat_fts_semantic_seg();
  if (phase === "messages_segmented") return m.habitat_fts_messages_seg();
  if (phase === "semantic_memory_embedding") return m.habitat_fts_semantic_emb();
  if (phase === "messages_embedding") return m.habitat_fts_messages_emb();
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
      <Table className="font-mono text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>{m.habitat_common_table()}</TableHead>
            <TableHead>{m.habitat_common_capability()}</TableHead>
            <TableHead>FTS</TableHead>
            <TableHead>{m.habitat_common_segmented()}</TableHead>
            <TableHead>trgm</TableHead>
            <TableHead>{m.habitat_common_embedding()}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.table}>
              <TableCell>
                <div className="font-sans font-medium">{row.label}</div>
                <div className="text-muted-foreground">{row.table}</div>
              </TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {[
                  row.capabilities.fts && "FTS",
                  row.capabilities.segmented && m.habitat_common_segmented(),
                  row.capabilities.trgm && "trgm",
                  row.capabilities.embedding && m.habitat_common_embedding(),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </TableCell>
              <TableCell>{row.capabilities.fts ? formatRatio(row.fts, row.total) : "—"}</TableCell>
              <TableCell>
                {row.capabilities.segmented
                  ? cjkEnabled
                    ? formatRatio(row.segmented, row.total)
                    : `${formatRatio(row.segmented, row.total)}*`
                  : "—"}
              </TableCell>
              <TableCell>{row.capabilities.trgm ? capabilityCell(true) : "—"}</TableCell>
              <TableCell>
                {row.capabilities.embedding ? formatRatio(row.embedding, row.total) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!cjkEnabled ? (
        <p className="text-xs text-muted-foreground mt-2 font-sans">* {m.habitat_fts_cjk_note()}</p>
      ) : null}
    </div>
  );
}

function RebuildProgress({ job }: { job: FtsRebuildJobStatus }) {
  if (!job.running && !job.error && !job.result) return null;

  const pct = job.total > 0 ? Math.min(100, Math.round((job.current / job.total) * 100)) : 0;
  const label = job.phase ? phaseLabel(job.phase) : m.habitat_common_preparing();

  return (
    <Card className="bg-muted py-0 mb-4">
      <CardContent className="gap-3 py-4 px-4">
        <h3 className="font-bold text-sm">{m.habitat_fts_rebuild_progress()}</h3>
        {job.running ? (
          <>
            <p className="text-sm font-sans">
              {label} · {formatRatio(job.current, job.total)}
              {job.only_missing ? m.habitat_common_only_missing() : m.habitat_common_full_rebuild()}
            </p>
            <progress className="w-full h-2 accent-primary" value={pct} max={100} />
            <p className="text-xs text-muted-foreground font-sans">
              {m.habitat_common_background_hint()}
            </p>
          </>
        ) : null}
        {job.error ? <StatusAlert variant="error">{job.error}</StatusAlert> : null}
        {job.result ? (
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(job.result, null, 2)}
          </pre>
        ) : null}
      </CardContent>
    </Card>
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
        m.habitat_common_load_failed({
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
        m.habitat_common_operation_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">{m.habitat_fts_title()}</h2>
      <p className="text-sm text-muted-foreground mb-4">{m.habitat_fts_desc()}</p>

      {error ? (
        <StatusAlert variant="error" className="mb-4">
          {error}
        </StatusAlert>
      ) : null}

      {job ? <RebuildProgress job={job} /> : null}

      <Card className="bg-muted py-0 mb-4">
        <CardContent className="gap-3 py-4 px-4">
          <h3 className="font-bold text-sm">{m.habitat_fts_coverage()}</h3>
          {status?.coverage?.tables?.length ? (
            <CoverageTable rows={status.coverage.tables} cjkEnabled={status.enabled} />
          ) : (
            <p className="text-sm text-muted-foreground">{m.habitat_fts_pg_unavailable()}</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted py-0 mb-4">
        <CardContent className="gap-3 py-4 px-4">
          <h3 className="font-bold text-sm">{m.habitat_common_config()}</h3>
          {status ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm font-mono">
              <dt className="text-muted-foreground">cjk.enabled</dt>
              <dd>{status.enabled ? "true" : "false"}</dd>
              <dt className="text-muted-foreground">dict_path</dt>
              <dd className="break-all">{status.dict_path}</dd>
              <dt className="text-muted-foreground">dict_exists</dt>
              <dd>{status.dict_exists ? "true" : "false"}</dd>
              <dt className="text-muted-foreground">embedding.enabled</dt>
              <dd>{status.embedding.enabled ? "true" : "false"}</dd>
              <dt className="text-muted-foreground">embedding.model</dt>
              <dd>{status.embedding.model ?? "—"}</dd>
              <dt className="text-muted-foreground">embedding.base_url</dt>
              <dd className="break-all">{status.embedding.base_url ?? "—"}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{m.habitat_common_load_failed_short()}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              isDisabled={loading || job?.running === true}
              onClick={() => void onRebuild(true)}
            >
              {job?.running ? m.habitat_fts_rebuilding() : m.habitat_fts_resume()}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              isDisabled={loading || job?.running === true}
              onClick={() => void onRebuild(false)}
            >
              {m.habitat_fts_full_rebuild()}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              isDisabled={loading}
              onClick={() => void reload()}
            >
              {m.habitat_fts_refresh_stats()}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
