import type { StreamEvent } from "@freeanima/runtime/loop";
import type { ConversationSummary } from "./schemas/snapshot.ts";

export type { MessagingPort } from "./messaging-port.ts";

/** Slash / platform 命令元数据 */
export type ServiceCommandInfo = {
  name: string;
  description: string;
  scope?: string;
  hidden?: boolean;
  platforms?: string[] | null;
};

/** 生命周期与并发控制 */
export type AppRuntimeLifecyclePort = {
  waitForDrain(): Promise<void>;
  getInFlightCount(): number;
  abortAll(): void;
  isShuttingDown(): boolean;
  startShutdown(): void;
  markStarted(): void;
};

/** 平台注册与 Gateway 消息流 */
export type AppRuntimeMessagingPort = {
  registerPlatform(name: string): void;
  updatePlatformStatus(name: string, status: string, extra?: Record<string, unknown>): void;
  findOrCreateConversation(
    platform: string,
    platform_extra?: Record<string, unknown>,
  ): Promise<{ conversation_id: string }>;
  executeCommand(params: {
    conversation_id: string;
    text: string;
    platform?: string;
    origin_extra?: Record<string, unknown>;
  }): Promise<{ text: string; data: unknown; found: boolean }>;
  sendMessageStream(
    conversationId: string,
    message: string,
    platform?: string,
    origin_extra?: Record<string, unknown>,
  ): AsyncGenerator<StreamEvent>;
  listCommands(opts?: { platform?: string; all?: boolean }): {
    commands: ServiceCommandInfo[];
  };
};

/** 健康检查、配置与 cron */
export type AppRuntimeOpsPort = {
  health(): any;
  buildStatus(host: string, port: number): Promise<any>;
  getConfig(): any;
  listToolsApi(scope?: "default" | "all"): any;
  listCronJobs(): any;
  pauseCronJob(id: string): any;
  resumeCronJob(id: string): any;
  runCronJobNow(id: string): any;
  getStatus(): Record<string, unknown>;
  getPromptDebug(conversationId?: string | null): Promise<any>;
};

/** 会话 CRUD 与消息 */
export type AppRuntimeConversationPort = {
  listConversations(
    platform?: string | null,
    opts?: { offset?: number; limit?: number },
  ): Promise<{ conversations: ConversationSummary[]; total: number }>;
  createConversation(platform: string): any;
  getConversationInfo(conversationId: string, platform?: string): Promise<any>;
  getConversationAcpDock(conversationId: string, platform?: string): Promise<any>;
  watchConversation(conversationId: string, cb: () => void): () => void;
  getMessages(
    conversationId: string,
    platform: string,
    opts?: { offset?: number; limit?: number },
  ): any;
  setConversationTitle(conversationId: string, title: string, platform: string): Promise<any>;
};

/** 语义 /  limbic / 自传 / 梦境记忆 */
export type AppRuntimeMemoryPort = {
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
  getFtsStatus(): Promise<any>;
  startRebuildFtsIndex(opts?: { onlyMissing?: boolean }): any;
  getRebuildFtsJobStatus(): any;
  listSelfBlocks(): Promise<any>;
};

/** 睡眠流水线与 auto-llm 审计 */
export type AppRuntimeSleepPort = {
  getSleepSummary(): Promise<any>;
  listPipelineStepRuns(opts?: {
    step_id?: string;
    run_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<any>;
  listCronLogs(opts?: {
    job_id?: string;
    limit?: number;
    offset?: number;
    ok?: boolean;
  }): Promise<any>;
  getDeepSleepRounds(day: string): { day: string; rounds: unknown[] };
  getSleepPipelineStatus(): any;
  startSleepCycle(opts?: {
    day?: string;
    deep_sleep_mode?: "full" | "incremental";
  }): Promise<{ ok: true; started: true } | { ok: false; error: string }>;
  startSleepPipelineStep(opts: {
    stepId: string;
    day?: string;
    force?: boolean;
    deep_sleep_mode?: "full" | "incremental";
  }): Promise<{ ok: true; result: unknown } | { ok: false; error: string }>;
  listAutoLlmRuns(opts?: {
    run_kind?: string;
    status?: "ok" | "error";
    limit?: number;
    offset?: number;
  }): Promise<any>;
};

/** Admin / Gateway 完整运行时 API 契约（域 port 组合） */
export type AppRuntimePort = AppRuntimeLifecyclePort &
  AppRuntimeMessagingPort &
  AppRuntimeOpsPort &
  AppRuntimeConversationPort &
  AppRuntimeMemoryPort &
  AppRuntimeSleepPort;
