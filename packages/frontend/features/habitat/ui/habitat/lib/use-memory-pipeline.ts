import { useCallback, useEffect, useState } from "react";
import { omitUndefined } from "./omit-undefined.ts";
import {
  getMemoryMaintenanceStatus,
  startMemoryMaintenanceCatchUp,
  startMemoryMaintenanceCycle,
  startMemoryMaintenanceStep,
} from "./api.ts";
import { logCaughtError } from "./log-caught-error.ts";

export type CatchUpStatus = {
  running: boolean;
  plan: {
    light_days: string[];
    temporal_days: string[];
    cascade_days: string[];
    days: string[];
  } | null;
  completed_light_days: string[];
  completed_temporal_days: string[];
  completed_cascade_days: string[];
  current_day: string | null;
  current_step: string | null;
  error: string | null;
  finished: boolean;
};

export type MaintenanceStatus = {
  running: boolean;
  step_running: boolean;
  catch_up_running?: boolean;
  steps?: readonly string[];
  catch_up?: CatchUpStatus;
};

export type ReflectMode = "full" | "incremental";

export type RunMaintenanceStepOpts = {
  day?: string;
  force?: boolean;
  reflect_mode?: ReflectMode;
};

/** 记忆维护状态轮询 + 单步 / 整周期 / 补跑触发（memoryMaintenance.*） */
export function useMemoryPipeline(opts?: { logScope?: string; onSettled?: () => void }) {
  const logScope = opts?.logScope ?? "memory-maintenance";
  const onSettled = opts?.onSettled;

  const [pipelineStatus, setPipelineStatus] = useState<MaintenanceStatus | null>(null);
  const [pipelineError, setPipelineError] = useState("");
  const [pipelineStarting, setPipelineStarting] = useState(false);
  const [catchUpStarting, setCatchUpStarting] = useState(false);
  const [runningStepId, setRunningStepId] = useState<string | null>(null);

  const refreshPipelineStatus = useCallback(async () => {
    try {
      const status = (await getMemoryMaintenanceStatus()) as MaintenanceStatus;
      setPipelineStatus(status);
      return status;
    } catch (err) {
      logCaughtError(`${logScope}/refreshStatus`, err);
      return null;
    }
  }, [logScope]);

  useEffect(() => {
    void refreshPipelineStatus();
  }, [refreshPipelineStatus]);

  useEffect(() => {
    if (
      !pipelineStatus?.running &&
      !pipelineStatus?.step_running &&
      !pipelineStatus?.catch_up_running
    ) {
      return () => {};
    }
    const timer = setInterval(() => {
      void refreshPipelineStatus();
    }, 2500);
    return () => clearInterval(timer);
  }, [
    pipelineStatus?.running,
    pipelineStatus?.step_running,
    pipelineStatus?.catch_up_running,
    refreshPipelineStatus,
  ]);

  useEffect(() => {
    if (
      pipelineStatus?.running ||
      pipelineStatus?.step_running ||
      pipelineStatus?.catch_up_running ||
      pipelineStarting ||
      catchUpStarting ||
      runningStepId
    ) {
      return;
    }
    if (!pipelineStatus?.catch_up?.finished) return;
    onSettled?.();
  }, [
    pipelineStatus?.running,
    pipelineStatus?.step_running,
    pipelineStatus?.catch_up_running,
    pipelineStatus?.catch_up?.finished,
    pipelineStarting,
    catchUpStarting,
    runningStepId,
    onSettled,
  ]);

  const pipelineBusy =
    pipelineStatus?.running ||
    pipelineStatus?.step_running ||
    pipelineStatus?.catch_up_running ||
    pipelineStarting ||
    catchUpStarting ||
    Boolean(runningStepId);

  const startCycle = useCallback(
    async (params?: { day?: string; reflect_mode?: ReflectMode }) => {
      setPipelineStarting(true);
      setPipelineError("");
      try {
        await startMemoryMaintenanceCycle(
          omitUndefined({
            day: params?.day?.trim() || undefined,
            reflect_mode: params?.reflect_mode,
          }),
        );
        await refreshPipelineStatus();
      } catch (e) {
        logCaughtError(`${logScope}/startCycle`, e);
        setPipelineError(e instanceof Error ? e.message : String(e));
      } finally {
        setPipelineStarting(false);
      }
    },
    [logScope, refreshPipelineStatus],
  );

  const startCatchUp = useCallback(async () => {
    setCatchUpStarting(true);
    setPipelineError("");
    try {
      await startMemoryMaintenanceCatchUp();
      await refreshPipelineStatus();
    } catch (e) {
      logCaughtError(`${logScope}/startCatchUp`, e);
      setPipelineError(e instanceof Error ? e.message : String(e));
    } finally {
      setCatchUpStarting(false);
    }
  }, [logScope, refreshPipelineStatus]);

  const startStep = useCallback(
    async (stepId: string, params?: RunMaintenanceStepOpts) => {
      setRunningStepId(stepId);
      setPipelineError("");
      try {
        await startMemoryMaintenanceStep(
          omitUndefined({
            step_id: stepId,
            day: params?.day?.trim() || undefined,
            force: params?.force,
            reflect_mode:
              stepId === "deep-sleep" || stepId === "reflect" ? params?.reflect_mode : undefined,
          }),
        );
        await refreshPipelineStatus();
        onSettled?.();
      } catch (e) {
        logCaughtError(`${logScope}/startStep`, e);
        setPipelineError(e instanceof Error ? e.message : String(e));
      } finally {
        setRunningStepId(null);
      }
    },
    [logScope, onSettled, refreshPipelineStatus],
  );

  const catchUp = pipelineStatus?.catch_up;
  const catchUpTotal =
    (catchUp?.plan?.light_days.length ?? 0) +
    (catchUp?.plan?.temporal_days.length ?? 0) +
    (catchUp?.plan?.cascade_days.length ?? 0);
  const catchUpDone =
    (catchUp?.completed_light_days.length ?? 0) +
    (catchUp?.completed_temporal_days.length ?? 0) +
    (catchUp?.completed_cascade_days.length ?? 0);
  const catchUpCurrent =
    catchUp?.current_step && catchUp.current_day
      ? `${catchUp.current_step} @ ${catchUp.current_day}`
      : (catchUp?.current_day ?? "—");

  return {
    pipelineStatus,
    pipelineError,
    setPipelineError,
    pipelineBusy,
    pipelineStarting,
    catchUpStarting,
    runningStepId,
    refreshPipelineStatus,
    startCycle,
    startCatchUp,
    startStep,
    catchUp,
    catchUpTotal,
    catchUpDone,
    catchUpCurrent,
  };
}
