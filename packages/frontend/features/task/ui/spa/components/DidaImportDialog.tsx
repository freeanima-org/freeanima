import { useMemo, useState } from "react";
import type { Key } from "react-aria-components";
import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import {
  buildDidaPreviewRows,
  parseDidaCsv,
  type DidaCsvParseResult,
  type DidaImportMode,
  type DidaPreviewRow,
} from "@freeanima/shared/task/dida-csv-import.ts";

type Step = "pick" | "preview" | "done";

function PreviewTable({ rows, noteHeader }: { rows: DidaPreviewRow[]; noteHeader: string }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-xs">无条目</p>;
  }
  return (
    <div className="border-border max-h-[min(28rem,50vh)] overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[7rem]">ID</TableHead>
            <TableHead>标题</TableHead>
            <TableHead className="w-[10rem]">清单</TableHead>
            <TableHead className="w-[5rem]">状态</TableHead>
            <TableHead>{noteHeader}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.client_op_id}>
              <TableCell className="font-mono text-xs whitespace-nowrap">
                {r.client_op_id.replace(/^dida:/, "")}
              </TableCell>
              <TableCell className="max-w-[16rem] truncate" title={r.title}>
                {r.title}
              </TableCell>
              <TableCell className="max-w-[10rem] truncate text-xs" title={r.list_label}>
                {r.list_label}
              </TableCell>
              <TableCell className="text-xs whitespace-nowrap">{r.status_label}</TableCell>
              <TableCell className="text-muted-foreground max-w-[18rem] text-xs" title={r.note}>
                {r.note || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function DidaImportDialog({
  open,
  subjectId,
  disabled,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  subjectId: number;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => Promise<void> | void;
}) {
  const [step, setStep] = useState<Step>("pick");
  const [mode, setMode] = useState<DidaImportMode>("upsert");
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Extract<DidaCsvParseResult, { ok: true }> | null>(null);
  const [tab, setTab] = useState<string>("ok");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    created_lists: number;
    updated_lists: number;
    created_tasks: number;
    updated_tasks: number;
    skipped: number;
    abandoned_skipped: number;
    warnings: string[];
    errors: string[];
  } | null>(null);

  const buckets = useMemo(() => (parsed ? buildDidaPreviewRows(parsed) : null), [parsed]);

  const reset = () => {
    setStep("pick");
    setFileName("");
    setCsvText(null);
    setParsed(null);
    setTab("ok");
    setError("");
    setResult(null);
  };

  const onFile = async (file: File | null) => {
    setError("");
    setResult(null);
    setCsvText(null);
    setParsed(null);
    setStep("pick");
    if (!file) {
      setFileName("");
      return;
    }
    setFileName(file.name);
    try {
      const text = await file.text();
      const next = parseDidaCsv(text);
      if (!next.ok) {
        setError(next.error);
        return;
      }
      setCsvText(text);
      setParsed(next);
      setTab("ok");
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runImport = async () => {
    if (!csvText || disabled) return;
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const out = await getTypedHabitatClient().call("task.importDidaCsv", {
        subject_id: subjectId,
        csv_text: csvText,
        mode,
      });
      setResult(out);
      setStep("done");
      await onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const folders = parsed?.lists.filter((l) => l.is_folder).length ?? 0;
  const lists = parsed?.lists.filter((l) => !l.is_folder).length ?? 0;

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      className="sm:max-w-5xl"
    >
      <DialogHeader>
        <DialogTitle>从滴答清单导入</DialogTitle>
      </DialogHeader>
      <div className="flex min-h-0 flex-col gap-3 px-1 py-2 text-sm">
        {step === "pick" ? (
          <>
            <p className="text-muted-foreground text-xs">
              使用滴答 Web「备份与导入」导出的 CSV（Version
              7.x）。第一步选择文件并预览，第二步确认写入。
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">选择 CSV 文件</span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={disabled || running}
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
              {fileName ? <span className="text-xs">{fileName}</span> : null}
            </label>
          </>
        ) : null}

        {step === "preview" && parsed && buckets ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs">
                版本 {parsed.version ?? "?"} · 文件夹 {folders} · 清单 {lists} · 将导入{" "}
                {buckets.ok.length + buckets.warn.length} · 警告 {buckets.warn.length} · 跳过{" "}
                {buckets.skipped.length}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                isDisabled={running}
                onClick={() => {
                  reset();
                }}
              >
                重选文件
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={mode === "create_only"}
                disabled={disabled || running}
                onChange={(e) => setMode(e.target.checked ? "create_only" : "upsert")}
              />
              仅创建（跳过已导入的 client_op_id）
            </label>
            <Tabs selectedKey={tab} onSelectionChange={(k: Key) => setTab(String(k))}>
              <TabsList className="h-auto w-full flex-wrap justify-start">
                <TabsTrigger id="ok">正常导入（{buckets.ok.length}）</TabsTrigger>
                <TabsTrigger id="warn">警告（{buckets.warn.length}）</TabsTrigger>
                <TabsTrigger id="skipped">跳过（{buckets.skipped.length}）</TabsTrigger>
              </TabsList>
              <TabsContent id="ok" className="mt-2">
                <PreviewTable rows={buckets.ok} noteHeader="备注" />
              </TabsContent>
              <TabsContent id="warn" className="mt-2">
                <p className="text-muted-foreground mb-2 text-xs">
                  仍会导入；下列字段可能已丢弃或降级（如重复规则）。
                </p>
                <PreviewTable rows={buckets.warn} noteHeader="警告" />
              </TabsContent>
              <TabsContent id="skipped" className="mt-2">
                <p className="text-muted-foreground mb-2 text-xs">不会写入 Habitat。</p>
                <PreviewTable rows={buckets.skipped} noteHeader="原因" />
              </TabsContent>
            </Tabs>
          </>
        ) : null}

        {step === "done" && result ? (
          <>
            <StatusAlert variant={result.errors.length > 0 ? "warning" : "success"}>
              清单 +{result.created_lists}/↻{result.updated_lists} · 任务 +{result.created_tasks}/↻
              {result.updated_tasks} · 跳过 {result.skipped} · 放弃 {result.abandoned_skipped}
              {result.errors.length > 0 ? ` · 失败 ${result.errors.length}` : ""}
            </StatusAlert>
            {result.errors.length > 0 ? (
              <pre className="bg-muted max-h-40 overflow-auto rounded p-2 text-xs">
                {result.errors.slice(0, 40).join("\n")}
              </pre>
            ) : null}
          </>
        ) : null}

        {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          关闭
        </Button>
        {step === "preview" ? (
          <Button
            type="button"
            isDisabled={disabled || running || !csvText}
            onClick={() => void runImport()}
          >
            {running ? <Spinner className="size-4" /> : null}
            确认导入
          </Button>
        ) : null}
        {step === "done" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
            }}
          >
            再导一份
          </Button>
        ) : null}
      </DialogFooter>
    </Dialog>
  );
}
