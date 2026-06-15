import type { StreamEvent } from "@freeanima/runtime/loop";

export type { MessagingPort } from "./ports/messaging-port.ts";

/** Slash / platform 命令元数据 */
export type ServiceCommandInfo = {
  name: string;
  description: string;
  scope?: string;
  hidden?: boolean;
  platforms?: string[] | null;
};

/** WebUI / Gateway 完整运行时 API 契约 */
export type AppRuntimePort = {
  registerPlatform(name: string): void;
  updatePlatformStatus(name: string, status: string, extra?: Record<string, unknown>): void;
  findOrCreateSession(
    platform: string,
    platform_extra?: Record<string, unknown>,
  ): Promise<{ session_id: string }>;
  executeCommand(params: {
    session_id: string;
    text: string;
    platform?: string;
    origin_extra?: Record<string, unknown>;
  }): Promise<{ text: string; data: unknown; found: boolean }>;
  sendMessageStream(
    sessionId: string,
    message: string,
    platform?: string,
  ): AsyncGenerator<StreamEvent>;
  listCommands(opts?: { platform?: string; all?: boolean }): {
    commands: ServiceCommandInfo[];
  };
  waitForDrain(): Promise<void>;
  getInFlightCount(): number;
  abortAll(): void;
  isShuttingDown(): boolean;
  startShutdown(): void;
  markStarted(): void;
  health(): any;
  buildStatus(host: string, port: number): Promise<any>;
  getConfig(): any;
  listToolsApi(): any;
  listCronJobs(): any;
  pauseCronJob(id: string): any;
  resumeCronJob(id: string): any;
  runCronJobNow(id: string): any;
  listSessions(platform?: string | null): Promise<any>;
  createSession(platform: string): any;
  getSessionInfo(sessionId: string, platform?: string): Promise<any>;
  getSessionAcpDock(sessionId: string, platform?: string): Promise<any>;
  watchSession(sessionId: string, cb: () => void): () => void;
  getMessages(sessionId: string, platform: string, opts?: { offset?: number; limit?: number }): any;
  setSessionTitle(sessionId: string, title: string, platform: string): Promise<any>;
  getStatus(): Record<string, unknown>;
  listMemoryFiles(): any;
  memorySearch(opts: any): Promise<any>;
  countSemanticMemory(): any;
  listSemanticMemories(opts?: any): Promise<any>;
  updateSemanticMemoryPinned(
    id: string,
    pinned: boolean,
  ): Promise<{ ok: true; id: string; pinned: boolean }>;
  listLimbicMemories(opts?: any): Promise<any>;
  listAutobiographicalMemories(opts?: any): Promise<any>;
  listDreamMemories(opts?: any): Promise<any>;
  getDreamMemoryByDay(day: string): Promise<any>;
  listTasks(opts?: any): Promise<any>;
  getFtsStatus(): Promise<any>;
  startRebuildFtsIndex(opts?: { onlyMissing?: boolean }): any;
  getRebuildFtsJobStatus(): any;
  listSelfBlocks(): Promise<any>;
  listFridgeMagnets(): Promise<any>;
  getPromptDebug(sessionId?: string | null): Promise<any>;
  getSleepSummary(): Promise<any>;
  listSleepRuns(opts?: { limit?: number; offset?: number; ok?: boolean }): Promise<any>;
  listCronLogs(opts?: {
    job_id?: string;
    limit?: number;
    offset?: number;
    ok?: boolean;
  }): Promise<any>;
  getDeepSleepRounds(day: string): { day: string; rounds: unknown[] };
  startLightSleepBackfill(opts?: {
    fromDay?: string;
    toDay?: string;
    resume?: boolean;
  }): Promise<{ ok: true; started: true } | { ok: false; error: string }>;
  getLightSleepBackfillStatus(): {
    running: boolean;
    from_day?: string;
    to_day?: string;
    completed_days: string[];
    last_error_day?: string | null;
    updated_at?: string;
    last_result?: unknown;
  };
  getSleepPipelineStatus(): any;
  startSleepCycle(opts?: {
    day?: string;
  }): Promise<{ ok: true; started: true } | { ok: false; error: string }>;
  startSleepPipelineStep(opts: {
    stepId: string;
    day?: string;
    force?: boolean;
  }): Promise<{ ok: true; result: unknown } | { ok: false; error: string }>;
};
