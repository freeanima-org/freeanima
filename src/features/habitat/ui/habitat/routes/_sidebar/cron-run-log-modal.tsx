import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Button,
  Dialog,
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
import { listCronLogs } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

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
        m.habitat_common_load_failed({
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
      isOpen
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className="max-w-3xl h-[85vh] flex flex-col overflow-hidden safe-area-pt safe-area-pb"
    >
      <DialogHeader className="shrink-0">
        <DialogTitle>{m.habitat_cron_run_history_title({ name: jobName })}</DialogTitle>
      </DialogHeader>
      <p className="text-xs font-mono text-muted-foreground mb-3 break-all shrink-0">{jobId}</p>

      <div className="flex justify-end mb-2 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          disabled={loading}
          onClick={() => void reload()}
        >
          {loading ? m.habitat_common_refreshing() : m.habitat_common_refresh_list()}
        </Button>
      </div>

      {error ? (
        <StatusAlert variant="error" className="mb-2 shrink-0">
          {error}
        </StatusAlert>
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m.habitat_common_time()}</TableHead>
              <TableHead>{m.habitat_common_status()}</TableHead>
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
                    {row.ok ? m.habitat_common_success() : m.habitat_common_failed()}
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
                        ? m.habitat_common_collapse()
                        : m.habitat_common_details()}
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
                  {m.habitat_cron_run_history_empty()}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DialogFooter className="shrink-0">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {m.habitat_common_close()}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
