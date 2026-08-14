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
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

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
  if (phase === "semantic_memory_segmented") return "语义记忆 · 分词";
  if (phase === "messages_segmented") return "对话消息 · 分词";
  if (phase === "semantic_memory_embedding") return "语义记忆 · 向量";
  if (phase === "messages_embedding") return "对话消息 · 向量";
  if (phase === "entities_embedding") return "实体 · 向量";
  return phase;
}

function formatRatio(n: number, total: number): string {
  return `${n}/${total}`;
}

function CoverageTable({ rows, cjkEnabled }: { rows: FtsTableCoverageRow[]; cjkEnabled: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table className="font-mono text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>{"表"}</TableHead>
            <TableHead>{"能力"}</TableHead>
            <TableHead>FTS</TableHead>
            <TableHead>{"分词"}</TableHead>
            <TableHead>{"向量"}</TableHead>
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
                  row.capabilities.segmented && "分词",
                  row.capabilities.trgm && "trgm",
                  row.capabilities.embedding && "向量",
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
              <TableCell>
                {row.capabilities.embedding ? formatRatio(row.embedding, row.total) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!cjkEnabled ? (
        <p className="text-xs text-muted-foreground mt-2 font-sans">
          * {"cjk.enabled 关闭时 fts_segmented 为空属正常；开启后需重建分词。"}
        </p>
      ) : null}
    </div>
  );
}

function RebuildProgress({ job }: { job: FtsRebuildJobStatus }) {
  if (!job.running && !job.error && !job.result) return null;

  const pct = job.total > 0 ? Math.min(100, Math.round((job.current / job.total) * 100)) : 0;
  const label = job.phase ? phaseLabel(job.phase) : "准备中";

  return (
    <Card className="bg-muted py-0 mb-4">
      <CardContent className="gap-3 py-4 px-4">
        <h3 className="font-bold text-sm">{"重建进度"}</h3>
        {job.running ? (
          <>
            <p className="text-sm font-sans">
              {label} · {formatRatio(job.current, job.total)}
              {job.only_missing ? "（仅补缺失）" : "（全量）"}
            </p>
            <progress className="w-full h-2 accent-primary" value={pct} max={100} />
            <p className="text-xs text-muted-foreground font-sans">
              {"后台运行中，可关闭对话框；再次打开可查看覆盖度变化。"}
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

export type FtsIndexPanelProps = {
  /** 为 true 时轮询状态；关闭后停止 */
  active: boolean;
};

/** 全文检索索引覆盖度与重建（数据维护 Dialog 内嵌） */
export function FtsIndexPanel({ active }: FtsIndexPanelProps) {
  const [status, setStatus] = useState<FtsStatus | null>(null);
  const [job, setJob] = useState<FtsRebuildJobStatus | null>(null);
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
      logCaughtError("components/habitat/FtsIndexPanel", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const pollJob = useCallback(async () => {
    try {
      const next = (await getRebuildFtsJobStatus()) as FtsRebuildJobStatus;
      setJob(next);
      if (!next.running) {
        await reload();
      }
    } catch (err) {
      logCaughtError("FtsIndexPanel/pollRebuildJob", err);
    }
  }, [reload]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      stopPoll();
      return () => {};
    }
    void reload();
    pollRef.current = setInterval(() => void pollJob(), 2000);
    return () => {
      stopPoll();
    };
  }, [active, pollJob, reload, stopPoll]);

  const onRebuild = async (onlyMissing: boolean) => {
    setLoading(true);
    setError("");
    try {
      const started = (await startRebuildFtsIndex({
        only_missing: onlyMissing,
      })) as FtsRebuildJobStatus;
      setJob(started);
    } catch (e) {
      logCaughtError("components/habitat/FtsIndexPanel", e);
      setError(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        {
          "重建在后台执行，不会阻塞页面。默认仅补缺失行，可断点续跑（如向量中断后再次点击即可继续）。"
        }
      </p>

      {error ? (
        <StatusAlert variant="error" className="mb-4">
          {error}
        </StatusAlert>
      ) : null}

      {job ? <RebuildProgress job={job} /> : null}

      <Card className="bg-muted py-0 mb-4">
        <CardContent className="gap-3 py-4 px-4">
          <h3 className="font-bold text-sm">{"索引覆盖度"}</h3>
          {status?.coverage?.tables?.length ? (
            <CoverageTable rows={status.coverage.tables} cjkEnabled={status.enabled} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {"无法读取 PG 统计（未连接或非 PG 主存）"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted py-0 mb-4">
        <CardContent className="gap-3 py-4 px-4">
          <h3 className="font-bold text-sm">{"配置"}</h3>
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
            <p className="text-sm text-muted-foreground">{"加载中…"}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              isDisabled={loading || job?.running === true}
              onClick={() => void onRebuild(true)}
            >
              {job?.running ? "重建中…" : "续跑 / 补缺失"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              isDisabled={loading || job?.running === true}
              onClick={() => void onRebuild(false)}
            >
              {"全量重建"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              isDisabled={loading}
              onClick={() => void reload()}
            >
              {"刷新统计"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
