import { formatCstIso } from "@freeanima/core/util";

import { readPipelineRunState, writePipelineRunState } from "./state.ts";
import { topologicalSort } from "./topo.ts";
import type {
  PipelineContext,
  PipelineDefinition,
  PipelineNodeDefinition,
  PipelineRunResult,
  PipelineRunState,
  PipelineStepFinishedEvent,
  PipelineStepFinishedListener,
  PipelineStepResult,
  PipelineStepState,
  RunStepResult,
  StepHandler,
  StepStatus,
} from "./types.ts";

function newRunId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pendingSteps(nodes: PipelineNodeDefinition[]): Record<string, PipelineStepState> {
  const steps: Record<string, PipelineStepState> = {};
  for (const node of nodes) {
    steps[node.id] = { status: "pending" };
  }
  return steps;
}

function finishedStepState(runState: PipelineRunState, stepId: string): PipelineStepState {
  const step = runState.steps[stepId];
  if (!step) throw new Error(`Pipeline step state missing: ${stepId}`);
  return step;
}

/** 轻量 DAG Pipeline 执行器 */
export class PipelineRunner {
  private readonly definitions = new Map<string, PipelineDefinition>();
  private readonly handlers = new Map<string, StepHandler>();
  private stepFinishedListener: PipelineStepFinishedListener | null = null;

  registerDefinition(def: PipelineDefinition): void {
    topologicalSort(def.nodes);
    this.definitions.set(def.id, def);
  }

  registerStep(handlerId: string, fn: StepHandler): void {
    this.handlers.set(handlerId, fn);
  }

  setStepFinishedListener(listener: PipelineStepFinishedListener | null): void {
    this.stepFinishedListener = listener;
  }

  getDefinition(pipelineId: string): PipelineDefinition | undefined {
    return this.definitions.get(pipelineId);
  }

  getRunState(pipelineId: string): PipelineRunState | null {
    return readPipelineRunState(pipelineId);
  }

  /** 运行完整 pipeline */
  async run(pipelineId: string, ctx: PipelineContext = {}): Promise<PipelineRunResult> {
    const def = this.definitions.get(pipelineId);
    if (!def) throw new Error(`Unknown pipeline: ${pipelineId}`);

    const order = topologicalSort(def.nodes);
    const runState: PipelineRunState = {
      pipeline_id: pipelineId,
      run_id: newRunId(),
      ...(ctx.day !== undefined ? { day: ctx.day } : {}),
      started_at: formatCstIso(),
      status: "running",
      steps: pendingSteps(def.nodes),
    };
    writePipelineRunState(runState);

    let pipelineFailed = false;

    for (const node of order) {
      if (!this.canRunAfterPriorSteps(node, runState)) {
        const finishedAt = formatCstIso();
        runState.steps[node.id] = {
          status: "skipped",
          finished_at: finishedAt,
          skipped_reason: "upstream_failed",
        };
        writePipelineRunState(runState);
        const skippedStep = runState.steps[node.id];
        if (skippedStep) {
          await this.emitStepFinished(pipelineId, runState, node.id, ctx, skippedStep);
        }
        continue;
      }

      const stepResult = await this.executeNode(node, ctx, runState);
      if (!stepResult.ok && stepResult.status === "failed" && !node.optional) {
        pipelineFailed = true;
      }
    }

    runState.finished_at = formatCstIso();
    runState.status = pipelineFailed ? "failed" : "completed";
    writePipelineRunState(runState);

    return {
      ok: !pipelineFailed,
      pipeline_id: pipelineId,
      run_id: runState.run_id,
      ...(runState.day !== undefined ? { day: runState.day } : {}),
      status: runState.status,
      steps: runState.steps,
    };
  }

  /** 单步运行（诊断）；默认检查依赖，force 可跳过 */
  async runStep(stepId: string, ctx: PipelineContext = {}): Promise<RunStepResult> {
    const def = this.findDefinitionForStep(stepId);
    if (!def) throw new Error(`Unknown pipeline step: ${stepId}`);

    const node = def.nodes.find((n) => n.id === stepId);
    if (!node) throw new Error(`Step not in pipeline definition: ${stepId}`);

    if (!ctx.force) {
      const depErr = this.checkDependencies(node, def, readPipelineRunState(def.id));
      if (depErr) {
        const runState = readPipelineRunState(def.id);
        const finishedAt = formatCstIso();
        const stepState: PipelineStepState = {
          status: "failed",
          finished_at: finishedAt,
          error: depErr,
        };
        if (runState) {
          await this.emitStepFinished(def.id, runState, stepId, ctx, stepState);
        }
        return {
          ok: false,
          step_id: stepId,
          status: "failed",
          dependency_error: depErr,
        };
      }
    }

    let runState: PipelineRunState =
      readPipelineRunState(def.id) ??
      ({
        pipeline_id: def.id,
        run_id: newRunId(),
        ...(ctx.day !== undefined ? { day: ctx.day } : {}),
        started_at: formatCstIso(),
        status: "running",
        steps: pendingSteps(def.nodes),
      } satisfies PipelineRunState);

    if (!runState.steps[stepId]) {
      runState.steps[stepId] = { status: "pending" };
    }

    const result = await this.executeNode(node, ctx, runState);
    writePipelineRunState(runState);

    return {
      ok: result.ok,
      step_id: stepId,
      status: result.status,
      ...(result.output !== undefined ? { output: result.output } : {}),
      ...(result.error !== undefined ? { error: result.error } : {}),
      ...(result.skipped_reason !== undefined ? { skipped_reason: result.skipped_reason } : {}),
    };
  }

  private findDefinitionForStep(stepId: string): PipelineDefinition | undefined {
    for (const def of this.definitions.values()) {
      if (def.nodes.some((n) => n.id === stepId)) return def;
    }
    return undefined;
  }

  private canRunAfterPriorSteps(node: PipelineNodeDefinition, runState: PipelineRunState): boolean {
    for (const depId of node.dependsOn ?? []) {
      const dep = runState.steps[depId];
      if (!dep) return false;
      if (dep.status === "completed") continue;
      if (dep.status === "skipped" && dep.skipped_reason !== "upstream_failed") continue;
      return false;
    }
    return true;
  }

  private checkDependencies(
    node: PipelineNodeDefinition,
    def: PipelineDefinition,
    runState: PipelineRunState | null,
  ): string | undefined {
    const deps = node.dependsOn ?? [];
    if (deps.length === 0) return undefined;
    if (!runState) {
      return `Dependencies not satisfied: ${deps.join(", ")} (no prior run state)`;
    }
    for (const depId of deps) {
      const dep = runState.steps[depId];
      if (!dep || (dep.status !== "completed" && dep.status !== "skipped")) {
        const depNode = def.nodes.find((n) => n.id === depId);
        const label = depNode?.id ?? depId;
        return `Dependency "${label}" not completed (status: ${dep?.status ?? "missing"})`;
      }
    }
    return undefined;
  }

  private async emitStepFinished(
    pipelineId: string,
    runState: PipelineRunState,
    stepId: string,
    ctx: PipelineContext,
    stepState: PipelineStepState,
  ): Promise<void> {
    if (!this.stepFinishedListener) return;
    if (stepState.status === "pending" || stepState.status === "running") return;

    const day = runState.day ?? ctx.day;
    const event: PipelineStepFinishedEvent = {
      pipeline_id: pipelineId,
      run_id: runState.run_id,
      step_id: stepId,
      ...(day !== undefined ? { day } : {}),
      ...(ctx.trigger !== undefined ? { trigger: ctx.trigger } : {}),
      status: stepState.status,
      ...(stepState.started_at !== undefined ? { started_at: stepState.started_at } : {}),
      finished_at: stepState.finished_at ?? formatCstIso(),
      ...(stepState.output !== undefined ? { output: stepState.output } : {}),
      ...(stepState.error !== undefined ? { error: stepState.error } : {}),
      ...(stepState.skipped_reason !== undefined
        ? { skipped_reason: stepState.skipped_reason }
        : {}),
    };
    await this.stepFinishedListener(event);
  }

  private async executeNode(
    node: PipelineNodeDefinition,
    ctx: PipelineContext,
    runState: PipelineRunState,
  ): Promise<{
    ok: boolean;
    status: StepStatus;
    output?: unknown;
    error?: string;
    skipped_reason?: string;
  }> {
    const pipelineId = runState.pipeline_id;
    const handler = this.handlers.get(node.handler);
    if (!handler) {
      const err = `No handler registered for: ${node.handler}`;
      const finishedAt = formatCstIso();
      runState.steps[node.id] = {
        status: "failed",
        started_at: finishedAt,
        finished_at: finishedAt,
        error: err,
      };
      await this.emitStepFinished(
        pipelineId,
        runState,
        node.id,
        ctx,
        finishedStepState(runState, node.id),
      );
      return { ok: false, status: "failed", error: err };
    }

    if (node.skipIf && (await node.skipIf(ctx))) {
      const finishedAt = formatCstIso();
      runState.steps[node.id] = {
        status: "skipped",
        started_at: finishedAt,
        finished_at: finishedAt,
        skipped_reason: "skipIf",
      };
      await this.emitStepFinished(
        pipelineId,
        runState,
        node.id,
        ctx,
        finishedStepState(runState, node.id),
      );
      return { ok: true, status: "skipped", skipped_reason: "skipIf" };
    }

    runState.steps[node.id] = {
      ...runState.steps[node.id],
      status: "running",
      started_at: formatCstIso(),
    };
    writePipelineRunState(runState);

    try {
      const result: PipelineStepResult = await handler(ctx);
      const finishedAt = formatCstIso();

      if (result.skipped) {
        const startedAt = runState.steps[node.id]?.started_at;
        runState.steps[node.id] = {
          status: "skipped",
          ...(startedAt !== undefined ? { started_at: startedAt } : {}),
          finished_at: finishedAt,
          ...(result.output !== undefined ? { output: result.output } : {}),
          skipped_reason: result.skipped,
        };
        await this.emitStepFinished(
          pipelineId,
          runState,
          node.id,
          ctx,
          finishedStepState(runState, node.id),
        );
        return {
          ok: true,
          status: "skipped",
          output: result.output,
          skipped_reason: result.skipped,
        };
      }

      if (!result.ok) {
        const startedAt = runState.steps[node.id]?.started_at;
        runState.steps[node.id] = {
          status: "failed",
          ...(startedAt !== undefined ? { started_at: startedAt } : {}),
          finished_at: finishedAt,
          ...(result.output !== undefined ? { output: result.output } : {}),
          error: result.error ?? "step failed",
        };
        await this.emitStepFinished(
          pipelineId,
          runState,
          node.id,
          ctx,
          finishedStepState(runState, node.id),
        );
        return {
          ok: false,
          status: "failed",
          output: result.output,
          error: result.error ?? "step failed",
        };
      }

      const startedAt = runState.steps[node.id]?.started_at;
      runState.steps[node.id] = {
        status: "completed",
        ...(startedAt !== undefined ? { started_at: startedAt } : {}),
        finished_at: finishedAt,
        ...(result.output !== undefined ? { output: result.output } : {}),
      };
      await this.emitStepFinished(
        pipelineId,
        runState,
        node.id,
        ctx,
        finishedStepState(runState, node.id),
      );
      return { ok: true, status: "completed", output: result.output };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const startedAt = runState.steps[node.id]?.started_at;
      runState.steps[node.id] = {
        status: "failed",
        ...(startedAt !== undefined ? { started_at: startedAt } : {}),
        finished_at: formatCstIso(),
        error: message,
      };
      await this.emitStepFinished(
        pipelineId,
        runState,
        node.id,
        ctx,
        finishedStepState(runState, node.id),
      );
      return { ok: false, status: "failed", error: message };
    }
  }
}

let defaultRunner: PipelineRunner | null = null;

export function getPipelineRunner(): PipelineRunner {
  if (!defaultRunner) defaultRunner = new PipelineRunner();
  return defaultRunner;
}

export function resetPipelineRunnerForTests(): void {
  defaultRunner = null;
}
