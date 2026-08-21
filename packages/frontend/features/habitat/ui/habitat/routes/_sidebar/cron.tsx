import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Label,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@freeanima/ui-kit";
import { showConfirm, StatusAlert } from "@freeanima/ui-kit/composite";
import {
  deleteCronJob,
  getCronJobs,
  pauseCronJob,
  resumeCronJob,
  runCronJob,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { CronCreateDialog } from "./cron-create-dialog.tsx";
import { CronRunLogModal } from "./cron-run-log-modal.tsx";
import {
  catchWithFallback,
  logCaughtError,
} from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

export const Route = createFileRoute("/_sidebar/cron")({
  loader: () => getCronJobs().catch(catchWithFallback("cron/getCronJobs", { jobs: [] })),
  component: CronPage,
});

type CronJob = Record<string, unknown> & { id: string; name?: string; paused?: boolean };

function CronPage() {
  const initial = Route.useLoaderData() as { jobs?: CronJob[] };

  const [jobs, setJobs] = useState<CronJob[]>(initial.jobs ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<Record<string, string>>({});
  const [historyJob, setHistoryJob] = useState<CronJob | null>(null);
  const [creating, setCreating] = useState(false);

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
      setJobs((data as { jobs?: CronJob[] }).jobs ?? []);
    } catch (e) {
      logCaughtError("routes/_sidebar/cron", e);
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
      const data = enable ? await resumeCronJob(job.id) : await pauseCronJob(job.id);
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
      const typed = data as unknown as { job?: CronJob };
      if (typed.job) updateJob(typed.job);
    } catch (e) {
      logCaughtError("routes/_sidebar/cron", e);
      setError(
        `${coerceString(job.name ?? job.id)} ${enable ? "启动" : "停止"}失败: ${e instanceof Error ? e.message : String(e)}`,
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
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
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
      setTimeout(() => void reload().catch(logCaughtError.bind(null, "cron/reloadAfterRun")), 2000);
    } catch (e) {
      logCaughtError("routes/_sidebar/cron", e);
      setError(
        `${coerceString(job.name ?? job.id)} 触发失败: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setRunning((r) => {
        const next = { ...r };
        delete next[job.id];
        return next;
      });
    }
  };

  const onDelete = async (job: CronJob) => {
    const confirmed = await showConfirm({
      description: `删除定时任务「${coerceString(job.name ?? job.id)}」？此操作不可撤销。`,
      confirmLabel: "删除",
      variant: "error",
    });
    if (!confirmed) return;
    setError("");
    setDeleting((d) => ({ ...d, [job.id]: true }));
    try {
      await deleteCronJob(job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } catch (e) {
      logCaughtError("routes/_sidebar/cron/delete", e);
      setError(
        `${coerceString(job.name ?? job.id)} 删除失败: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setDeleting((d) => {
        const next = { ...d };
        delete next[job.id];
        return next;
      });
    }
  };

  const busy = (job: CronJob) => !!toggling[job.id] || !!running[job.id] || !!deleting[job.id];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{"⏰ 定时任务"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {"查看、新建、启用/暂停、手动触发与删除调度任务。高级脚本任务可用 ToolSet "}
            <code className="text-xs">cronjob</code>
            {"。"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => setCreating(true)}>
            {"新建"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            isDisabled={loading}
            onClick={() => void reload()}
          >
            {"刷新"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              ["任务总数", jobs.length],
              ["运行中", activeCount],
              ["已暂停", pausedCount],
            ].map(([label, value]) => (
              <Card key={String(label)} className="bg-muted py-0">
                <CardContent className="py-4 px-4">
                  <h3 className="text-sm text-muted-foreground">{label}</h3>
                  <p className="text-2xl font-mono">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {jobs.length === 0 ? (
            <StatusAlert variant="info">{"暂无定时任务。"}</StatusAlert>
          ) : (
            jobs.map((job) => (
              <Card key={job.id} className="bg-muted py-0">
                <CardContent className="py-4 px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{job.name}</h3>
                      <Badge variant={job.paused ? "ghost" : "success"} className="text-xs">
                        {job.paused ? "已暂停" : "运行中"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`cron-enable-${job.id}`} className="text-xs">
                          {"启用"}
                        </Label>
                        <Switch
                          id={`cron-enable-${job.id}`}
                          isSelected={!job.paused}
                          isDisabled={busy(job)}
                          onChange={(checked) => void onToggle(job, checked)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        isDisabled={busy(job)}
                        onClick={() => setHistoryJob(job)}
                      >
                        {"运行历史"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        isDisabled={busy(job)}
                        onClick={() => void runNow(job)}
                      >
                        {running[job.id] ? <Spinner /> : null}
                        {"立即运行"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive"
                        isDisabled={busy(job)}
                        onClick={() => void onDelete(job)}
                      >
                        {deleting[job.id] ? <Spinner /> : null}
                        {"删除"}
                      </Button>
                    </div>
                  </div>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-muted-foreground w-24">ID</TableCell>
                        <TableCell className="font-mono text-xs break-all">{job.id}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground">{"调度"}</TableCell>
                        <TableCell className="font-mono">{coerceString(job.schedule)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground">{"下次运行"}</TableCell>
                        <TableCell>
                          {job.paused
                            ? "—"
                            : formatDisplayDateTime(Number(job.next_run_at), { seconds: true })}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  {toast[job.id] ? (
                    <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                      {toast[job.id]}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {error ? (
        <StatusAlert variant="error" className="mt-4">
          {error}
        </StatusAlert>
      ) : null}

      {historyJob ? (
        <CronRunLogModal
          jobId={historyJob.id}
          jobName={coerceString(historyJob.name ?? historyJob.id)}
          onClose={() => setHistoryJob(null)}
        />
      ) : null}

      {creating ? (
        <CronCreateDialog
          onClose={() => setCreating(false)}
          onCreated={(job) => {
            setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
            setCreating(false);
          }}
        />
      ) : null}
    </div>
  );
}
