import { useCallback, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import {
  runDataIntegrityCheck,
  type DataIntegrityReport,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

/** 数据维护网格：手动跑通用数据完整性检查并展示结果 */
export function DataIntegrityCard() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<DataIntegrityReport | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError("");
    try {
      const next = await runDataIntegrityCheck();
      setReport(next);
      setOpen(true);
    } catch (err) {
      logCaughtError("data-maintenance/data-integrity", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <>
      <Card className="h-full">
        <CardContent className="flex h-full flex-col gap-3 py-3 px-4">
          <div className="min-h-0 flex-1">
            <h2 className="text-sm font-medium">{"数据完整性"}</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              {
                "只读检测实体 world 引用、任务清单/项目归属、主体私有世界与默认收件箱等。不修改数据。"
              }
            </p>
            {error ? (
              <StatusAlert variant="error" className="mt-2">
                {error}
              </StatusAlert>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            className="self-start"
            isDisabled={running}
            onClick={() => void run()}
          >
            {running ? "检测中…" : "手动检测"}
          </Button>
        </CardContent>
      </Card>

      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        className="max-w-3xl w-[calc(100%-2rem)] sm:max-w-3xl h-[80vh] flex flex-col overflow-hidden safe-area-pt safe-area-pb"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{"数据完整性检测结果"}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-1">
          {report ? (
            <div className="flex flex-col gap-3 py-1">
              <StatusAlert variant={report.ok ? "success" : "warning"}>
                {report.ok
                  ? `通过（扫描 ${report.entity_count} 条实体）`
                  : `发现 ${report.issue_count} 个问题（扫描 ${report.entity_count} 条实体）`}
                {report.truncated ? "；列表已截断，仅显示前若干条" : ""}
              </StatusAlert>
              {report.issues.length > 0 ? (
                <ul className="text-muted-foreground flex flex-col gap-2 text-xs font-mono">
                  {report.issues.map((issue, idx) => (
                    <li
                      key={`${issue.code}-${issue.entity_id ?? "n"}-${idx}`}
                      className="border-border rounded-md border px-2 py-1.5"
                    >
                      <div className="text-foreground font-sans text-xs font-medium">
                        {issue.code}
                        {issue.entity_id != null ? ` · entity ${issue.entity_id}` : ""}
                      </div>
                      <div className="mt-0.5 break-all">{issue.message}</div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter className="shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            isDisabled={running}
            onClick={() => void run()}
          >
            {running ? "检测中…" : "重新检测"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            {"关闭"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
