import { Fragment, useCallback, useEffect, useState } from "react";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { listCronLogs } from "@admin/lib/api.ts";
import { formatDisplayDateTime } from "@admin/lib/format-datetime.ts";
import { m } from "@admin/lib/i18n.ts";
import { logCaughtError } from "@admin/lib/log-caught-error.ts";

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
        m.admin_common_load_failed({
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
    <dialog className="modal modal-open safe-area-pt safe-area-pb">
      <div className="modal-box max-w-3xl">
        <h3 className="font-bold text-lg mb-1">
          {m.admin_cron_run_history_title({ name: jobName })}
        </h3>
        <p className="text-xs font-mono text-base-content/60 mb-3 break-all">{jobId}</p>

        <div className="flex justify-end mb-2">
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            disabled={loading}
            onClick={() => void reload()}
          >
            {loading ? m.admin_common_refreshing() : m.admin_common_refresh_list()}
          </button>
        </div>

        {error ? (
          <StatusAlert variant="error" className="mb-2">
            {error}
          </StatusAlert>
        ) : null}

        <div className="overflow-x-auto max-h-[60vh]">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>{m.admin_common_time()}</th>
                <th>{m.admin_common_status()}</th>
                <th>#</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className={row.ok ? "" : "bg-error/10"}>
                    <td className="whitespace-nowrap">{formatDisplayDateTime(row.finished_at)}</td>
                    <td>{row.ok ? m.admin_common_success() : m.admin_common_failed()}</td>
                    <td className="font-mono text-xs">{row.run_count}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-xs"
                        onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                      >
                        {expandedId === row.id
                          ? m.admin_common_collapse()
                          : m.admin_common_details()}
                      </button>
                    </td>
                  </tr>
                  {expandedId === row.id && (
                    <tr>
                      <td colSpan={4} className="bg-base-200">
                        {!row.ok && row.error && (
                          <pre className="text-xs text-error whitespace-pre-wrap break-all">
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
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan={4} className="text-center text-base-content/50">
                    {m.admin_cron_run_history_empty()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-sm" onClick={onClose}>
            {m.admin_common_close()}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
}
