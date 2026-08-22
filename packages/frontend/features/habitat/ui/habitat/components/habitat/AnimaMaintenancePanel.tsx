import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@freeanima/ui-kit";
import { DatePickerInput } from "@freeanima/ui-kit/form/DatePickerInput.tsx";
import { FormField, FormFieldLabel, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { omitUndefined } from "@freeanima/features/habitat/ui/habitat/lib/omit-undefined.ts";
import {
  type ReflectMode,
  useMemoryPipeline,
} from "@freeanima/features/habitat/ui/habitat/lib/use-memory-pipeline.ts";

const CLUSTER_CALIBRATE_STEP = "semantic-cluster-calibrate";
const CLUSTER_TITLE_STEP = "semantic-cluster-title";

type Props = {
  /** 卧室当前所选 Anima subject id；未选时为 null */
  agentSubjectId: number | null;
};

/** 卧室「维护」：当前 Anima 的记忆巩固 / 聚类 / 分族名称（合并入口） */
export function AnimaMaintenancePanel({ agentSubjectId }: Props) {
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
  } = useMemoryPipeline({
    logScope: "bedroom/maintenance",
    agentSubjectId,
  });

  const day = pipelineDay.trim() || undefined;
  const catchUpBusy = Boolean(pipelineStatus?.catch_up_running) || catchUpStarting;
  const showCatchUpProgress = (catchUpBusy || Boolean(catchUp?.finished)) && catchUpTotal > 0;
  const noAgent = agentSubjectId == null;
  const calibrating = runningStepId === CLUSTER_CALIBRATE_STEP;
  const warmingTitles = runningStepId === CLUSTER_TITLE_STEP;

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">{"维护"}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {noAgent
            ? "请先在顶栏选择卧室 Anima；下列操作仅作用于该 Anima 的私有 World。"
            : `针对当前 Anima（subject #${String(agentSubjectId)}）的记忆巩固与语义聚类。LLM 过程见栖息地「自动 LLM 运行」。`}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 py-4 px-4">
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-medium">{"记忆巩固"}</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {"Retain 补跑、Reflect 巩固，以及缺口一键补跑（含时间摘要）。"}
              </p>
            </div>

            <FormFieldset bordered={false} className="gap-2">
              <FormField label={"日期（可选，默认今天）"} className="max-w-xs text-xs">
                <DatePickerInput
                  className="h-8"
                  value={pipelineDay}
                  aria-label={"日期（可选）"}
                  onChange={setPipelineDay}
                  disabled={pipelineBusy || noAgent}
                />
              </FormField>
            </FormFieldset>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                isDisabled={pipelineBusy || noAgent}
                onClick={() => void startStep("retain-catch-up", omitUndefined({ day }))}
              >
                {runningStepId === "retain-catch-up" ? "Retain 中…" : "运行 Retain"}
              </Button>
            </div>

            <div className="max-w-sm">
              <FormFieldLabel className="py-0 text-xs">{"Reflect 模式"}</FormFieldLabel>
              <Select
                selectedKey={reflectMode}
                onSelectionChange={(key) => {
                  if (key === "full" || key === "incremental") setReflectMode(key);
                }}
                isDisabled={pipelineBusy || noAgent}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem id="full">{"完整（全部步骤）"}</SelectItem>
                  <SelectItem id="incremental">{"增量（跳过静默步骤）"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="self-start"
              isDisabled={pipelineBusy || noAgent}
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

            <div className="border-border border-t pt-4">
              <p className="text-muted-foreground mb-2 text-xs">
                {
                  "一键补跑：从最早活动日补到今天；缺 Retain 的天补 Retain，缺日摘要的天补时间摘要（与上方日期无关）。"
                }
              </p>
              <Button
                type="button"
                size="sm"
                className="self-start"
                isDisabled={pipelineBusy || noAgent}
                onClick={() => void startCatchUp()}
              >
                {catchUpBusy ? "补跑中…" : "开始一键补跑"}
              </Button>
              {showCatchUpProgress ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  {`进度：${catchUpCurrent}（${String(catchUpDone)}/${String(catchUpTotal)}）`}
                  {catchUp?.error ? (
                    <span className="text-destructive ml-1">— {catchUp.error}</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </section>

          <section className="border-border flex flex-col gap-3 border-t pt-5">
            <div>
              <h2 className="text-sm font-medium">{"语义聚类"}</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {"全量 DBSCAN 校准，以及已有簇的短标题补全（LLM）。"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                title={"对语义记忆 embedding 做 DBSCAN 全量校准（可能耗时）"}
                isDisabled={pipelineBusy || noAgent}
                onClick={() => void startStep(CLUSTER_CALIBRATE_STEP)}
              >
                {calibrating ? <Spinner className="size-3.5" /> : null}
                {calibrating ? "聚类中…" : "全量聚类"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                title={"为当前 Anima 私有 World 内的分族补全短标题"}
                isDisabled={pipelineBusy || noAgent}
                onClick={() => void startStep(CLUSTER_TITLE_STEP)}
              >
                {warmingTitles ? "补全中…" : "补全分族名称"}
              </Button>
            </div>
          </section>

          {pipelineError ? <p className="text-destructive text-sm">{pipelineError}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
