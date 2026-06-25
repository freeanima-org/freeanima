import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getCronJobs, pauseCronJob, resumeCronJob, runCronJob } from "@admin/lib/api.ts";
import { formatDisplayDateTime } from "@admin/lib/format-datetime.ts";
import { m } from "@admin/lib/i18n.ts";
import { CronRunLogModal } from "./cron-run-log-modal.tsx";
import { catchWithFallback, logCaughtError } from "@admin/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/cron")({
  loader: () => getCronJobs().catch(catchWithFallback("cron/getCronJobs", { jobs: [] })),
  component: CronPage,
});

type CronJob = Record<string, unknown> & { id: string; name?: string; paused?: boolean };

function CronPage() {
  const initial = Route.useLoaderData() as { jobs?: CronJob[] };

  const [jobs, setJobs] = useState<CronJob[]>((initial.jobs ?? []) as CronJob[]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<Record<string, string>>({});
  const [historyJob, setHistoryJob] = useState<CronJob | null>(null);

  const activeCount = jobs.filter((j) => !j.paused).length;
  const pausedCount = jobs.filter((j) => j.paused).length;

  const updateJob = (updated: CronJob) => {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)));
  };

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getCronJobs();
      setJobs(((data as { jobs?: CronJob[] }).jobs ?? []) as CronJob[]);
    } catch (e) {
      logCaughtError("routes/_sidebar/cron", e);
      setError(
        m.admin_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  const onToggle = async (job: CronJob, enable: boolean) => {
    const action = enable ? "resume" : "pause";
    setError("");
    setToggling((t) => ({ ...t, [job.id]: action }));
    try {
      const data = enable ? await resumeCronJob(job.id) : await pauseCronJob(job.id);
      if ((data as { job?: CronJob }).job) updateJob((data as { job: CronJob }).job);
    } catch (e) {
      logCaughtError("routes/_sidebar/cron", e);
      setError(
        m.admin_cron_toggle_failed({
          name: String(job.name ?? job.id),
          action: enable ? m.admin_common_start() : m.admin_common_stop(),
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setToggling((t) => {
        const next = { ...t };
        delete next[job.id];
        return next;
      });
    }
  };

  const runNow = async (job: CronJob) => {
    setError("");
    setRunning((r) => ({ ...r, [job.id]: true }));
    try {
      const data = await runCronJob(job.id);
      if ((data as { job?: CronJob }).job) updateJob((data as { job: CronJob }).job);
      setToast((t) => ({
        ...t,
        [job.id]: (data as { message?: string }).message || m.admin_cron_triggered(),
      }));
      setTimeout(() => {
        setToast((t) => {
          const next = { ...t };
          delete next[job.id];
          return next;
        });
      }, 4000);
      setTimeout(() => void reload().catch(logCaughtError.bind(null, "cron/reloadAfterRun")), 2000);
    } catch (e) {
      logCaughtError("routes/_sidebar/cron", e);
      setError(
        m.admin_cron_trigger_failed({
          name: String(job.name ?? job.id),
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setRunning((r) => {
        const next = { ...r };
        delete next[job.id];
        return next;
      });
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{m.admin_nav_cron()}</h2>
          <p className="text-sm text-base-content/60 mt-1">
            {m.admin_cron_desc()} <code className="text-xs">cronjob</code>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={loading}
          onClick={() => void reload()}
        >
          {m.admin_common_refresh()}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-dots loading-md" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card bg-base-200">
              <div className="card-body py-4">
                <h3 className="text-sm text-base-content/60">{m.admin_cron_total()}</h3>
                <p className="text-2xl font-mono">{jobs.length}</p>
              </div>
            </div>
            <div className="card bg-base-200">
              <div className="card-body py-4">
                <h3 className="text-sm text-base-content/60">{m.admin_cron_active()}</h3>
                <p className="text-2xl font-mono">{activeCount}</p>
              </div>
            </div>
            <div className="card bg-base-200">
              <div className="card-body py-4">
                <h3 className="text-sm text-base-content/60">{m.admin_cron_paused()}</h3>
                <p className="text-2xl font-mono">{pausedCount}</p>
              </div>
            </div>
          </div>

          {jobs.length === 0 ? (
            <div className="alert alert-info text-sm">{m.admin_cron_empty()}</div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="card bg-base-200">
                <div className="card-body">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{job.name}</h3>
                      <span
                        className={`badge badge-sm ${job.paused ? "badge-ghost" : "badge-success"}`}
                      >
                        {job.paused ? m.admin_cron_status_paused() : m.admin_cron_status_active()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="label cursor-pointer gap-2 py-0">
                        <span className="label-text text-xs">{m.admin_cron_enable()}</span>
                        <input
                          type="checkbox"
                          className="toggle toggle-sm toggle-primary"
                          checked={!job.paused}
                          disabled={!!toggling[job.id] || !!running[job.id]}
                          onChange={(e) => void onToggle(job, e.target.checked)}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        disabled={!!toggling[job.id] || !!running[job.id]}
                        onClick={() => setHistoryJob(job)}
                      >
                        {m.admin_cron_run_history()}
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        disabled={!!toggling[job.id] || !!running[job.id]}
                        onClick={() => void runNow(job)}
                      >
                        {running[job.id] ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : null}
                        {m.admin_cron_run_now()}
                      </button>
                    </div>
                  </div>
                  <table className="table table-xs">
                    <tbody>
                      <tr>
                        <td className="text-base-content/50 w-24">ID</td>
                        <td className="font-mono text-xs break-all">{job.id}</td>
                      </tr>
                      <tr>
                        <td className="text-base-content/50">{m.admin_cron_schedule()}</td>
                        <td className="font-mono">{String(job.schedule ?? "")}</td>
                      </tr>
                      <tr>
                        <td className="text-base-content/50">{m.admin_cron_next_run()}</td>
                        <td>
                          {job.paused
                            ? "—"
                            : formatDisplayDateTime(Number(job.next_run_at), { seconds: true })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {toast[job.id] ? (
                    <p className="text-xs text-success mt-2">{toast[job.id]}</p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {error ? <div className="alert alert-error text-sm mt-4">{error}</div> : null}

      {historyJob ? (
        <CronRunLogModal
          jobId={historyJob.id}
          jobName={String(historyJob.name ?? historyJob.id)}
          onClose={() => setHistoryJob(null)}
        />
      ) : null}
    </div>
  );
}
