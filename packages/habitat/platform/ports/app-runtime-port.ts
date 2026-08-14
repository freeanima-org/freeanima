import type { StreamEvent } from "@freeanima/habitat/engine/loop";
import type { CronJobData } from "@freeanima/habitat/capabilities/connectors/cron/schema.ts";
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
  createCronJob(opts: {
    name: string;
    schedule: string;
    prompt: string;
    notify_on_success?: boolean;
  }): Promise<CronJobData>;
  deleteCronJob(id: string): Promise<boolean>;
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

/** 语义记忆 / 时间摘要 / FTS / 自我层 */
export type AppRuntimeMemoryPort = {
  passiveRecallDebug(opts: Record<string, unknown>): Promise<unknown>;
  listTemporalSummaries(opts?: Record<string, unknown>): Promise<unknown>;
  regenerateTemporalSummary(opts: Record<string, unknown>): Promise<unknown>;
  backfillMissingTemporalSummaries(opts: Record<string, unknown>): Promise<unknown>;
  rebuildTemporalSummariesInRange(opts: Record<string, unknown>): Promise<unknown>;
  getTemporalSummaryBatchJobStatus(): unknown;
  listTemporalSystemRolls(): Promise<unknown>;
  regenerateTemporalSystemRoll(opts: Record<string, unknown>): Promise<unknown>;
  startTemporalSystemRollBatch(opts?: Record<string, unknown>): unknown;
  getTemporalSystemRollBatchStatus(): unknown;
  countSemanticMemory(): Promise<{ index_rows: number }>;
  listSemanticMemories(opts?: Record<string, unknown>): Promise<unknown>;
  updateSemanticMemoryPinned(
    id: number | string,
    pinned: boolean,
  ): Promise<{ ok: true; id: number; pinned: boolean }>;
  getFtsStatus(): Promise<unknown>;
  startRebuildFtsIndex(opts?: { onlyMissing?: boolean }): unknown;
  getRebuildFtsJobStatus(): unknown;
  listSelfBlocks(): Promise<unknown>;
};

/** 记忆维护与 auto-llm 审计 */
export type AppRuntimeSleepPort = {
  getMemoryMaintenanceSummary(): Promise<unknown>;
  listCronLogs(opts?: {
    job_id?: string;
    limit?: number;
    offset?: number;
    ok?: boolean;
  }): Promise<unknown>;
  getMemoryMaintenanceStatus(): unknown;
  startMemoryMaintenanceCycle(opts?: {
    day?: string;
    reflect_mode?: "full" | "incremental";
  }): Promise<{ ok: true; started: true } | { ok: false; error: string }>;
  startMemoryMaintenanceStep(opts: {
    stepId: string;
    day?: string;
    force?: boolean;
    reflect_mode?: "full" | "incremental";
  }): Promise<{ ok: true; result: unknown } | { ok: false; error: string }>;
  startMemoryMaintenanceCatchUp(): Promise<
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
