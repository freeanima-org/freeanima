import { useState } from "react";
import { Button, Card, CardContent } from "@freeanima/ui-kit";
import { DatePickerInput } from "@freeanima/ui-kit/form/DatePickerInput.tsx";
import { FormField, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { omitUndefined } from "@freeanima/features/habitat/ui/habitat/lib/omit-undefined.ts";
import { useMemoryPipeline } from "@freeanima/features/habitat/ui/habitat/lib/use-memory-pipeline.ts";

/** 数据维护网格：会话清理 + 完整维护周期 */
export function MemoryPipelineOpsCard() {
  const [pipelineDay, setPipelineDay] = useState("");

  const {
    pipelineStatus,
    pipelineError,
    pipelineBusy,
    pipelineStarting,
    runningStepId,
    startCycle,
    startStep,
  } = useMemoryPipeline({ logScope: "data-maintenance/pipeline" });

  return (
    <Card className="h-full sm:col-span-2">
      <CardContent className="flex h-full flex-col gap-3 py-3 px-4">
        <div className="min-h-0 flex-1">
          <h2 className="text-sm font-medium">{"会话与记忆维护"}</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {"清理与夜间同款周期（不含自动 Retain）。过程见「自动 LLM 运行」。"}
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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            isDisabled={pipelineBusy}
            onClick={() =>
              void startStep(
                "conversation-cleanup",
                omitUndefined({ day: pipelineDay.trim() || undefined }),
              )
            }
          >
            {runningStepId === "conversation-cleanup" ? "清理中…" : "会话清理"}
          </Button>
          <Button
            type="button"
            size="sm"
            isDisabled={pipelineBusy}
            onClick={() => void startCycle(omitUndefined({ day: pipelineDay.trim() || undefined }))}
          >
            {pipelineStatus?.running || pipelineStarting ? "运行中…" : "完整维护周期"}
          </Button>
        </div>

        {pipelineError ? <p className="text-destructive text-xs">{pipelineError}</p> : null}
      </CardContent>
    </Card>
  );
}
