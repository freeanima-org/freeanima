import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { listCronLogs } from "@console/lib/api.ts";
import { formatDisplayDateTime } from "@console/lib/format-datetime.ts";
import { m } from "@console/lib/i18n.ts";
import { logCaughtError } from "@console/lib/log-caught-error.ts";

type CronLogRow = {
  id: number;
  job_id: string;
  run_count: number;
  ok: boolean;
  finished_at: string | Date | null;
  output: Record<string, unknown> | null;
  output_text: string | null;
  error: string | null;
};

type CronRunLogModalProps = {
  jobId: string;
  jobName: string;
  onClose: () => void;
};

export function CronRunLogModal({ jobId, jobName, onClose }: CronRunLogModalProps) {
  const [rows, setRows] = useState<CronLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listCronLogs({ job_id: jobId, limit: 50 });
      setRows((data as { items?: CronLogRow[] }).items ?? []);
    } catch (e) {
      logCaughtError("routes/_sidebar/cron-run-log-modal", e);
      setError(
        m.console_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-3xl safe-area-pt safe-area-pb">
        <DialogHeader>
          <DialogTitle>{m.console_cron_run_history_title({ name: jobName })}</DialogTitle>
        </DialogHeader>
        <p className="text-xs font-mono text-muted-foreground mb-3 break-all">{jobId}</p>

        <div className="flex justify-end mb-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={loading}
            onClick={() => void reload()}
          >
            {loading ? m.console_common_refreshing() : m.console_common_refresh_list()}
          </Button>
        </div>

        {error ? (
          <StatusAlert variant="error" className="mb-2">
            {error}
          </StatusAlert>
        ) : null}

        <div className="overflow-x-auto max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.console_common_time()}</TableHead>
                <TableHead>{m.console_common_status()}</TableHead>
                <TableHead>#</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow className={row.ok ? "" : "bg-destructive/10"}>
                    <TableCell className="whitespace-nowrap">
                      {formatDisplayDateTime(row.finished_at)}
                    </TableCell>
                    <TableCell>
                      {row.ok ? m.console_common_success() : m.console_common_failed()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.run_count}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                      >
                        {expandedId === row.id
                          ? m.console_common_collapse()
                          : m.console_common_details()}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === row.id && (
                    <TableRow>
                      <TableCell colSpan={4} className="bg-muted">
                        {!row.ok && row.error && (
                          <pre className="text-xs text-destructive whitespace-pre-wrap break-all">
                            {row.error}
                          </pre>
                        )}
                        {row.ok && row.output && (
                          <pre className="text-xs whitespace-pre-wrap break-all max-h-48 overflow-auto">
                            {JSON.stringify(row.output, null, 2)}
                          </pre>
                        )}
                        {row.ok && !row.output && row.output_text && (
                          <pre className="text-xs whitespace-pre-wrap break-all max-h-48 overflow-auto">
                            {row.output_text}
                          </pre>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {m.console_cron_run_history_empty()}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {m.console_common_close()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
