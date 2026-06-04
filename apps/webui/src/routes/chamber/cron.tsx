import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/chamber/cron")({
  loader: () => trpc.status.cronJobs.query().catch(() => ({ jobs: [] })),
  component: CronPage,
});

type CronJob = Record<string, unknown> & { id: string; name?: string; paused?: boolean };

function formatTs(ts: number) {
  if (!ts || ts <= 0) return "—";
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function CronPage() {
  const initial = Route.useLoaderData() as { jobs?: CronJob[] };

  const [jobs, setJobs] = useState<CronJob[]>((initial.jobs ?? []) as CronJob[]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<Record<string, string>>({});

  const activeCount = jobs.filter((j) => !j.paused).length;
  const pausedCount = jobs.filter((j) => j.paused).length;

  const updateJob = (updated: CronJob) => {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)));
  };

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await trpc.status.cronJobs.query();
      setJobs(((data as { jobs?: CronJob[] }).jobs ?? []) as CronJob[]);
    } catch (e) {
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const onToggle = async (job: CronJob, enable: boolean) => {
    const action = enable ? "resume" : "pause";
    setError("");
    setToggling((t) => ({ ...t, [job.id]: action }));
    try {
      const data = enable
        ? await trpc.status.resumeCron.mutate({ id: job.id })
        : await trpc.status.pauseCron.mutate({ id: job.id });
      if ((data as { job?: CronJob }).job) updateJob((data as { job: CronJob }).job);
    } catch (e) {
      setError(
        `${job.name} ${enable ? "启用" : "暂停"}失败: ${e instanceof Error ? e.message : String(e)}`,
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
      const data = await trpc.status.runCron.mutate({ id: job.id });
      if ((data as { job?: CronJob }).job) updateJob((data as { job: CronJob }).job);
      setToast((t) => ({
        ...t,
        [job.id]: (data as { message?: string }).message || "已触发",
      }));
      setTimeout(() => {
        setToast((t) => {
          const next = { ...t };
          delete next[job.id];
          return next;
        });
      }, 4000);
      setTimeout(() => void reload().catch(() => {}), 2000);
    } catch (e) {
      setError(`${job.name} 触发失败: ${e instanceof Error ? e.message : String(e)}`);
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
          <h2 className="text-lg font-bold">⏰ 定时任务</h2>
          <p className="text-sm text-base-content/60 mt-1">
            查看调度任务、启用/暂停与手动触发。新建或删除请使用{" "}
            <code className="text-xs">cronjob</code> 工具。
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={loading}
          onClick={() => void reload()}
        >
          刷新
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
                <h3 className="text-sm text-base-content/60">任务总数</h3>
                <p className="text-2xl font-mono">{jobs.length}</p>
              </div>
            </div>
            <div className="card bg-base-200">
              <div className="card-body py-4">
                <h3 className="text-sm text-base-content/60">运行中</h3>
                <p className="text-2xl font-mono">{activeCount}</p>
              </div>
            </div>
            <div className="card bg-base-200">
              <div className="card-body py-4">
                <h3 className="text-sm text-base-content/60">已暂停</h3>
                <p className="text-2xl font-mono">{pausedCount}</p>
              </div>
            </div>
          </div>

          {jobs.length === 0 ? (
            <div className="alert alert-info text-sm">暂无定时任务。</div>
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
                        {job.paused ? "已暂停" : "运行中"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="label cursor-pointer gap-2 py-0">
                        <span className="label-text text-xs">启用</span>
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
                        className="btn btn-xs btn-outline"
                        disabled={!!toggling[job.id] || !!running[job.id]}
                        onClick={() => void runNow(job)}
                      >
                        {running[job.id] ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : null}
                        立即运行
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
                        <td className="text-base-content/50">调度</td>
                        <td className="font-mono">{String(job.schedule ?? "")}</td>
                      </tr>
                      <tr>
                        <td className="text-base-content/50">下次运行</td>
                        <td>{job.paused ? "—" : formatTs(Number(job.next_run_at))}</td>
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
    </div>
  );
}
