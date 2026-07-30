import type { StreamEvent } from "@freeanima/host/engine/loop";
import type { CronJobData } from "@freeanima/host/capabilities/connectors/cron/schema.ts";
import type {
  ConversationSummary,
  HealthSnapshot,
  SafeConfigSnapshot,
  ServiceSnapshot,
} from "./schemas/snapshot.ts";

export type { MessagingPort } from "./messaging-port.ts";

/** Slash / platform 命令元数据 */
export type ServiceCommandInfo = {
  name: string;
  description: string;
  scope?: string;
  hidden?: boolean;
  platforms?: string[] | null;
  subcommands?: { name: string; description: string }[];
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
  }): Promise<{ text: string; data: unknown; found: boolean; ux?: "panel" | "toast" | "none" }>;
  runConversationCommand(params: {
    conversation_id: string;
    text: string;
    platform?: string;
    origin_extra?: Record<string, unknown>;
  }): Promise<
    | { delivery: "message" }
    | { delivery: "rpc"; ux: "panel" | "toast" | "none"; text: string; command: string }
  >;
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
  health(): HealthSnapshot;
  buildStatus(host: string, port: number): Promise<ServiceSnapshot>;
  getConfig(): SafeConfigSnapshot;
  listToolsApi(scope?: "default" | "all"): unknown;
  listCronJobs(): Promise<{ jobs: CronJobData[] }>;
  pauseCronJob(id: string): Promise<CronJobData | null>;
  resumeCronJob(id: string): Promise<CronJobData | null>;
  runCronJobNow(id: string): Promise<{ job: CronJobData; message: string } | null>;
  getStatus(): Record<string, unknown>;
  getPromptDebug(conversationId?: string | null): Promise<unknown>;
};

/** 会话 CRUD 与消息 */
export type AppRuntimeConversationPort = {
  listConversations(
    platform?: string | null,
    opts?: { offset?: number; limit?: number },
  ): Promise<{ conversations: ConversationSummary[]; total: number }>;
  createConversation(platform: string): Promise<{ conversation_id: string }>;
  getConversationInfo(conversationId: string, platform?: string): Promise<unknown>;
  watchConversation(conversationId: string, cb: () => void): () => void;
  /** 任意会话更新（用户未读 / inbox） */
  watchInbox(cb: (conversationId: string) => void): () => void;
  getMessages(
    conversationId: string,
    platform?: string,
    opts?: { offset?: number; limit?: number | null; before_pos?: number },
  ): Promise<unknown>;
  setConversationTitle(conversationId: string, title: string, platform: string): Promise<unknown>;
};

/** 语义 /  limbic / 自传 / 梦境记忆 */
export type AppRuntimeMemoryPort = {
  listMemoryFiles(): Promise<unknown>;
  memorySearch(opts: Record<string, unknown>): Promise<unknown>;
  countSemanticMemory(): Promise<{ index_rows: number }>;
  listSemanticMemories(opts?: Record<string, unknown>): Promise<unknown>;
  updateSemanticMemoryPinned(
    id: number | string,
    pinned: boolean,
  ): Promise<{ ok: true; id: number; pinned: boolean }>;
  listLimbicMemories(opts?: Record<string, unknown>): Promise<unknown>;
  listAutobiographicalMemories(opts?: Record<string, unknown>): Promise<unknown>;
  getFtsStatus(): Promise<unknown>;
  startRebuildFtsIndex(opts?: { onlyMissing?: boolean }): unknown;
  getRebuildFtsJobStatus(): unknown;
  listSelfBlocks(): Promise<unknown>;
};

/** 睡眠流水线与 auto-llm 审计 */
export type AppRuntimeSleepPort = {
  getSleepSummary(): Promise<unknown>;
  listPipelineStepRuns(opts?: {
    step_id?: string;
    run_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown>;
  listCronLogs(opts?: {
    job_id?: string;
    limit?: number;
    offset?: number;
    ok?: boolean;
  }): Promise<unknown>;
  getSleepPipelineStatus(): unknown;
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
  startSleepCatchUp(): Promise<
    { ok: true; started: true; plan: unknown } | { ok: false; error: string }
  >;
  listAutoLlmRuns(opts?: {
    run_kind?: string;
    status?: "ok" | "error";
    limit?: number;
    offset?: number;
  }): Promise<unknown>;
  getAutoLlmRun(id: string): Promise<unknown>;
};

/** Habitat / Gateway 完整运行时 API 契约（域 port 组合） */
export type AppRuntimePort = AppRuntimeLifecyclePort &
  AppRuntimeMessagingPort &
  AppRuntimeOpsPort &
  AppRuntimeConversationPort &
  AppRuntimeMemoryPort &
  AppRuntimeSleepPort;
