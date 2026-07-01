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
import { StatusAlert } from "@freeanima/ui-kit/composite";
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
          <p className="text-sm text-muted-foreground mt-1">
            {m.admin_cron_desc()} <code className="text-xs">cronjob</code>
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => void reload()}
        >
          {m.admin_common_refresh()}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              [m.admin_cron_total(), jobs.length],
              [m.admin_cron_active(), activeCount],
              [m.admin_cron_paused(), pausedCount],
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
            <StatusAlert variant="info">{m.admin_cron_empty()}</StatusAlert>
          ) : (
            jobs.map((job) => (
              <Card key={job.id} className="bg-muted py-0">
                <CardContent className="py-4 px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{job.name}</h3>
                      <Badge variant={job.paused ? "ghost" : "success"} className="text-xs">
                        {job.paused ? m.admin_cron_status_paused() : m.admin_cron_status_active()}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`cron-enable-${job.id}`} className="text-xs">
                          {m.admin_cron_enable()}
                        </Label>
                        <Switch
                          id={`cron-enable-${job.id}`}
                          checked={!job.paused}
                          disabled={!!toggling[job.id] || !!running[job.id]}
                          onCheckedChange={(checked) => void onToggle(job, checked)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={!!toggling[job.id] || !!running[job.id]}
                        onClick={() => setHistoryJob(job)}
                      >
                        {m.admin_cron_run_history()}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={!!toggling[job.id] || !!running[job.id]}
                        onClick={() => void runNow(job)}
                      >
                        {running[job.id] ? <Spinner /> : null}
                        {m.admin_cron_run_now()}
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
                        <TableCell className="text-muted-foreground">
                          {m.admin_cron_schedule()}
                        </TableCell>
                        <TableCell className="font-mono">{String(job.schedule ?? "")}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground">
                          {m.admin_cron_next_run()}
                        </TableCell>
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
          jobName={String(historyJob.name ?? historyJob.id)}
          onClose={() => setHistoryJob(null)}
        />
      ) : null}
    </div>
  );
}
