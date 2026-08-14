import { useState } from "react";
import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@freeanima/ui-kit";
import { DatePickerInput } from "@freeanima/ui-kit/form/DatePickerInput.tsx";
import { FormField, FormFieldLabel, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { omitUndefined } from "@freeanima/features/habitat/ui/habitat/lib/omit-undefined.ts";
import {
  type ReflectMode,
  useMemoryPipeline,
} from "@freeanima/features/habitat/ui/habitat/lib/use-memory-pipeline.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** 语义记忆：Retain / Reflect / 一键补跑（Dialog） */
export function MemoryConsolidationDialog({ open, onOpenChange }: Props) {
  const [pipelineDay, setPipelineDay] = useState("");
  const [reflectMode, setReflectMode] = useState<ReflectMode>("full");

  const {
    pipelineStatus,
    pipelineError,
    pipelineBusy,
    catchUpStarting,
    runningStepId,
    startCatchUp,
    startStep,
    catchUp,
    catchUpTotal,
    catchUpDone,
    catchUpCurrent,
  } = useMemoryPipeline({ logScope: "semantic-memory/consolidation" });

  const day = pipelineDay.trim() || undefined;
  const catchUpBusy = Boolean(pipelineStatus?.catch_up_running) || catchUpStarting;
  const showCatchUpProgress = (catchUpBusy || Boolean(catchUp?.finished)) && catchUpTotal > 0;

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="max-w-lg w-[calc(100%-2rem)] sm:max-w-lg flex flex-col overflow-hidden safe-area-pt safe-area-pb"
    >
      <DialogHeader className="shrink-0">
        <DialogTitle>{"记忆巩固"}</DialogTitle>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-1">
        <p className="text-muted-foreground text-xs">
          {"LLM 过程见「自动 LLM 运行」中的 memory-retain / memory-reflect。"}
        </p>

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-medium">{"1. Retain 补跑"}</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {"对指定 CST 日（默认今天）有消息的会话补跑 Retain。"}
            </p>
          </div>
          <FormFieldset bordered={false} className="gap-2">
            <FormField label={"日期（可选）"} className="max-w-xs text-xs">
              <DatePickerInput
                className="h-8"
                value={pipelineDay}
                aria-label={"日期（可选）"}
                onChange={setPipelineDay}
                disabled={pipelineBusy}
              />
            </FormField>
          </FormFieldset>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="self-start"
            isDisabled={pipelineBusy}
            onClick={() => void startStep("retain-catch-up", omitUndefined({ day }))}
          >
            {runningStepId === "retain-catch-up" ? "Retain 中…" : "运行 Retain"}
          </Button>
        </section>

        <section className="border-border flex flex-col gap-3 border-t pt-5">
          <div>
            <h3 className="text-sm font-medium">{"2. Reflect 巩固"}</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {"对语义库存做矛盾/拆分/合并等巩固轮次。"}
            </p>
          </div>
          <div className="max-w-sm">
            <FormFieldLabel className="py-0 text-xs">{"模式"}</FormFieldLabel>
            <Select
              selectedKey={reflectMode}
              onSelectionChange={(key) => {
                if (key === "full" || key === "incremental") setReflectMode(key);
              }}
              isDisabled={pipelineBusy}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem id="full">{"完整（全部轮次）"}</SelectItem>
                <SelectItem id="incremental">{"增量（跳过静默轮次）"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="self-start"
            isDisabled={pipelineBusy}
            onClick={() =>
              void startStep(
                "reflect",
                omitUndefined({
                  day,
                  reflect_mode: reflectMode,
                }),
              )
            }
          >
            {runningStepId === "reflect" ? "Reflect 中…" : "运行 Reflect"}
          </Button>
        </section>

        <section className="border-border flex flex-col gap-3 border-t pt-5">
          <div>
            <h3 className="text-sm font-medium">{"3. 一键补跑缺口"}</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {
                "从最早活动日补到今天：缺 Retain 的天补 Retain，缺全局日摘要的天补时间摘要（与上方日期无关）。"
              }
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="self-start"
            isDisabled={pipelineBusy}
            onClick={() => void startCatchUp()}
          >
            {catchUpBusy ? "补跑中…" : "开始一键补跑"}
          </Button>
          {showCatchUpProgress ? (
            <p className="text-muted-foreground text-xs">
              {`进度：${catchUpCurrent}（${String(catchUpDone)}/${String(catchUpTotal)}）`}
              {catchUp?.error ? (
                <span className="text-destructive ml-1">— {catchUp.error}</span>
              ) : null}
            </p>
          ) : null}
        </section>

        {pipelineError ? <p className="text-destructive text-sm">{pipelineError}</p> : null}
      </div>

      <DialogFooter className="shrink-0">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {"关闭"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
