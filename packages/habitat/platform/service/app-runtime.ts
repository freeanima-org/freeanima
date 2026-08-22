import type {
  HealthSnapshot,
  PlatformStatusSnapshot,
  SafeConfigSnapshot,
  ServiceSnapshot,
  ConversationSummary,
} from "@freeanima/habitat/platform/schemas/snapshot";
import type { StreamEvent } from "@freeanima/habitat/kernel/loop-mechanism";
import type { StoredMessage as Message } from "@freeanima/habitat/core/db/domain";
import type { ConversationService } from "@freeanima/habitat/engine/conversation";
import type { CronJobData } from "@freeanima/habitat/capabilities/connectors/cron";
import type { Kernel } from "@freeanima/habitat/kernel";
import type { AppRuntimePort } from "@freeanima/habitat/platform/ports/app-runtime-port";
import type { McpManagerPort } from "@freeanima/habitat/platform/ports/mcp-manager";
import type { RemoteToolsManagerPort } from "@freeanima/habitat/platform/ports/remote-tools-manager";
import type { ServiceEnginePort } from "@freeanima/habitat/platform/ports/service-engine";
import {
  collectStreamReply,
  createConversationAfterMessagesPersisted,
} from "@freeanima/habitat/kernel/loop-mechanism";
import { createTurnMessageCallbacks, type StreamTurnHost } from "./turn-lifecycle.ts";
import { EngineRunControl } from "./engine-run-control.ts";
import { ConversationManager } from "./conversation-manager.ts";
import type { FullRuntimeDeps, RuntimeDeps } from "./runtime-deps.ts";
import * as status from "./service-status.ts";
import * as conversations from "./service-conversations.ts";
import * as memory from "./service-memory.ts";
import * as selfLayer from "./service-self.ts";
import * as fts from "./service-fts.ts";
import * as promptDebug from "./service-prompt-debug.ts";
import * as memoryMaintenance from "./service-memory-maintenance.ts";
import * as autoLlmRuns from "./service-auto-llm-runs.ts";
import * as llmUsage from "./service-llm-usage.ts";
import * as messaging from "./service-messaging.ts";
import { omitUndefined } from "@freeanima/habitat/core/util";

export type { StreamEvent } from "@freeanima/habitat/kernel/loop-mechanism";
export { ConversationManager } from "./conversation-manager.ts";

export type CreateAppRuntimeInput = FullRuntimeDeps;

export class AppRuntime implements StreamTurnHost, AppRuntimePort {
  private startTime = 0;
  private platformStatus: Record<string, PlatformStatusSnapshot> = {};
  private readonly runControl = new EngineRunControl();
  private readonly conversationManager = new ConversationManager();
  private onConversationUpdated: ((sid: string) => void) | null = null;
  private readonly conversationWatchers = new Map<string, Set<() => void>>();
  private readonly inboxWatchers = new Set<(conversationId: string) => void>();

  readonly kernel: Kernel;
  readonly engine: ServiceEnginePort;
  readonly conversation: ConversationService;
  readonly mcp: McpManagerPort | null;
  readonly outpost: RemoteToolsManagerPort | null;
  readonly host: string;
  readonly port: number;

  constructor(input: CreateAppRuntimeInput) {
    this.kernel = input.kernel;
    this.engine = input.engine;
    this.conversation = input.conversation;
    this.mcp = input.mcp;
    this.outpost = input.outpost;
    this.host = input.host;
    this.port = input.port;
  }

  fullDeps(): FullRuntimeDeps {
    return {
      kernel: this.kernel,
      engine: this.engine,
      conversation: this.conversation,
      mcp: this.mcp,
      outpost: this.outpost,
      host: this.host,
      port: this.port,
    };
  }

  runtimeDeps(): RuntimeDeps {
    return {
      kernel: this.kernel,
      engine: this.engine,
      conversation: this.conversation,
    };
  }

  private messagingDeps(): messaging.MessagingDeps {
    return {
      runControl: this.runControl,
      conversationManager: this.conversationManager,
      onConversationUpdated: this.onConversationUpdated,
      streamHost: this,
    };
  }

  runExclusive<T>(conversationId: string, fn: () => Promise<T>): Promise<T> {
    return this.conversationManager.runExclusive(conversationId, fn);
  }

  beginEngineRun(conversationId: string): { signal: AbortSignal; controller: AbortController } {
    return this.runControl.beginEngineRun(conversationId);
  }

  endEngineRun(conversationId: string, controller: AbortController): void {
    this.runControl.endEngineRun(conversationId, controller);
  }

  acquireInFlight(): void {
    this.runControl.acquireInFlight();
  }

  releaseInFlight(): void {
    this.runControl.releaseInFlight();
  }

  engineStreamOpts(conversationId: string, signal: AbortSignal, llmDebug?: boolean) {
    return {
      hookRegistry: this.kernel.hookRegistry,
      llm_kind: "conversation" as const,
      conversationId,
      toolProgress: true as const,
      onAfterMessagesPersisted: createConversationAfterMessagesPersisted(conversationId),
      ...createTurnMessageCallbacks(this.fullDeps(), conversationId),
      signal,
      shouldStop: () => this.runControl.isShuttingDown(),
      ...omitUndefined({ llm_debug: llmDebug ? true : undefined }),
    };
  }

  async reloadRuntimeAfterRepair(conversationId: string): Promise<[Message[], string[]]> {
    await this.conversation.repairAndPersistToolLoop(
      conversationId,
      await this.conversation.load(conversationId),
    );
    return this.conversation.buildRuntimeMessages(conversationId);
  }

  async onTurnAfterComplete(
    conversationId: string,
    msgs: Message[],
    reply: string,
  ): Promise<string> {
    return messaging.runTurnAfterCompleteHooks(this.fullDeps(), conversationId, msgs, reply);
  }

  emitSessionUpdated(conversationId: string): void {
    messaging.emitSessionUpdated(
      {
        kernel: this.kernel,
        onConversationUpdated: this.onConversationUpdated,
      },
      conversationId,
    );
    this.pokeSessionWatchers(conversationId);
  }

  /** Habitat SSE: wake watchers without re-running onConversationUpdated (ACP progress already notified). */
  pokeSessionWatchers(conversationId: string): void {
    const set = this.conversationWatchers.get(conversationId);
    if (set) {
      for (const cb of set) {
        try {
          cb();
        } catch {
          /* ignore watcher errors */
        }
      }
    }
    for (const cb of this.inboxWatchers) {
      try {
        cb(conversationId);
      } catch {
        /* ignore watcher errors */
      }
    }
  }

  /** Habitat SSE: notify when conversation messages/meta change (ACP progress, callbacks). */
  watchConversation(conversationId: string, cb: () => void): () => void {
    let set = this.conversationWatchers.get(conversationId);
    if (!set) {
      set = new Set();
      this.conversationWatchers.set(conversationId, set);
    }
    set.add(cb);
    return () => {
      set?.delete(cb);
      if (set && set.size === 0) this.conversationWatchers.delete(conversationId);
    };
  }

  /** 任意会话更新（用户未读角标 / 会话列表 inbox） */
  watchInbox(cb: (conversationId: string) => void): () => void {
    this.inboxWatchers.add(cb);
    return () => {
      this.inboxWatchers.delete(cb);
    };
  }

  isShuttingDown(): boolean {
    return this.runControl.isShuttingDown();
  }

  async waitForDrain(): Promise<void> {
    return this.runControl.waitForDrain();
  }

  startShutdown(): void {
    this.runControl.startShutdown();
  }

  getInFlightCount(): number {
    return this.runControl.getInFlightCount();
  }

  abortAll(): void {
    this.runControl.abortAll();
  }

  setOnSessionUpdated(cb: (sid: string) => void): void {
    this.onConversationUpdated = cb;
  }

  markStarted(): void {
    this.startTime = Date.now() / 1000;
  }

  get start_time(): number {
    return this.startTime;
  }

  registerPlatform(name: string): void {
    this.platformStatus[name] = { status: "starting", since: Date.now() / 1000 };
  }

  updatePlatformStatus(
    name: string,
    statusText: string,
    extra: Record<string, unknown> = {},
  ): void {
    this.platformStatus[name] = { status: statusText, ...extra };
  }

  getPlatformStatus(): Record<string, PlatformStatusSnapshot> {
    return { ...this.platformStatus };
  }

  health(): HealthSnapshot {
    return status.health(this.startTime);
  }

  async buildStatus(host: string, port: number): Promise<ServiceSnapshot> {
    const cronJobs = await status.listCronJobs();
    return status.buildStatus(
      this.fullDeps(),
      this.startTime,
      this.platformStatus,
      cronJobs.jobs.length,
      host,
      port,
    );
  }

  listConversations(
    platform?: string | null,
    opts?: { offset?: number; limit?: number; includeArchived?: boolean },
  ): Promise<{ conversations: ConversationSummary[]; total: number }> {
    return conversations.listConversations(this.runtimeDeps(), platform, opts);
  }

  createConversation(platform: string): Promise<{ conversation_id: string }> {
    return conversations.createConversation(this.runtimeDeps(), platform);
  }

  findOrCreateConversation(
    platform: string,
    platform_extra: Record<string, unknown> = {},
  ): Promise<{ conversation_id: string }> {
    return conversations.findOrCreateConversation(this.runtimeDeps(), platform, platform_extra);
  }

  patchConversationOrigin(
    conversation_id: string,
    platform: string,
    platform_extra?: Record<string, unknown>,
  ): Promise<{ ok: boolean }> {
    return conversations.patchConversationOrigin(
      this.runtimeDeps(),
      conversation_id,
      platform,
      platform_extra,
    );
  }

  executeCommand(params: {
    conversation_id: string;
    text: string;
    platform?: string;
    origin_extra?: Record<string, unknown>;
  }) {
    return messaging.executeCommand(this.fullDeps(), this.messagingDeps(), params);
  }

  runConversationCommand(params: {
    conversation_id: string;
    text: string;
    platform?: string;
    origin_extra?: Record<string, unknown>;
  }): Promise<messaging.ConversationCommandRpcResult> {
    return messaging.runConversationCommand(this.fullDeps(), this.messagingDeps(), params);
  }

  getConversationInfo(conversationId: string, platform = ""): Promise<Record<string, unknown>> {
    return conversations.getConversationInfo(this.runtimeDeps(), conversationId, platform);
  }

  getMessages(
    conversationId: string,
    platform = "",
    opts?: { offset?: number; limit?: number | null; before_pos?: number },
  ) {
    return conversations.getMessages(this.runtimeDeps(), conversationId, platform, opts);
  }

  setConversationTitle(
    conversationId: string,
    title: string,
    platform = "",
  ): Promise<{ ok: boolean }> {
    return conversations.setConversationTitle(this.runtimeDeps(), conversationId, title, platform);
  }

  archiveConversation(conversationId: string, platform = ""): Promise<{ ok: boolean }> {
    return conversations.archiveConversation(this.runtimeDeps(), conversationId, platform);
  }

  unarchiveConversation(conversationId: string, platform = ""): Promise<{ ok: boolean }> {
    return conversations.unarchiveConversation(this.runtimeDeps(), conversationId, platform);
  }

  pinConversation(conversationId: string, platform = ""): Promise<{ ok: boolean }> {
    return conversations.pinConversation(this.runtimeDeps(), conversationId, platform);
  }

  unpinConversation(conversationId: string, platform = ""): Promise<{ ok: boolean }> {
    return conversations.unpinConversation(this.runtimeDeps(), conversationId, platform);
  }

  deleteConversation(conversationId: string, platform = ""): Promise<{ ok: boolean }> {
    return conversations.deleteConversation(this.runtimeDeps(), conversationId, platform);
  }

  rollbackBeforeLastUser(conversationId: string, platform = ""): Promise<{ ok: boolean }> {
    return conversations.rollbackBeforeLastUser(this.runtimeDeps(), conversationId, platform);
  }

  async sendMessage(
    conversationId: string,
    message: string,
    platform?: string,
  ): Promise<{ conversation_id: string; content: string }> {
    const content = await collectStreamReply(
      messaging.sendMessageStream(
        this.fullDeps(),
        this.messagingDeps(),
        conversationId,
        message,
        platform,
      ),
    );
    return { conversation_id: conversationId, content };
  }

  sendMessageStream(
    conversationId: string,
    message: string,
    platform?: string,
    origin_extra?: Record<string, unknown>,
  ): AsyncGenerator<StreamEvent> {
    return messaging.sendMessageStream(
      this.fullDeps(),
      this.messagingDeps(),
      conversationId,
      message,
      platform,
      origin_extra,
    );
  }

  continueMessageStream(
    conversationId: string,
    platform?: string,
    origin_extra?: Record<string, unknown>,
  ): AsyncGenerator<StreamEvent> {
    return messaging.continueMessageStream(
      this.fullDeps(),
      this.messagingDeps(),
      conversationId,
      platform,
      origin_extra,
    );
  }

  interruptSessionStream(conversationId: string): void {
    messaging.interruptSessionStream(this.messagingDeps(), conversationId);
  }

  passiveRecallDebug(args: { user_text: string; limit?: number }) {
    return memory.passiveRecallDebug(args);
  }

  listTemporalSummaries(args: Parameters<typeof memory.listTemporalSummaryMemories>[0]) {
    return memory.listTemporalSummaryMemories(args);
  }

  regenerateTemporalSummary(args: Parameters<typeof memory.regenerateTemporalSummary>[0]) {
    return memory.regenerateTemporalSummary(args);
  }

  backfillMissingTemporalSummaries(
    args: Parameters<typeof memory.backfillMissingTemporalSummaries>[0],
  ) {
    return memory.backfillMissingTemporalSummaries(args);
  }

  rebuildTemporalSummariesInRange(
    args: Parameters<typeof memory.rebuildTemporalSummariesInRange>[0],
  ) {
    return memory.rebuildTemporalSummariesInRange(args);
  }

  getTemporalSummaryBatchJobStatus() {
    return memory.getTemporalSummaryBatchJobStatus();
  }

  listTemporalSystemRolls(args: { agent_subject_id: number }) {
    return memory.listTemporalSystemRollMemories(args);
  }

  regenerateTemporalSystemRoll(
    args: Parameters<typeof memory.regenerateTemporalSystemRollMemory>[0],
  ) {
    return memory.regenerateTemporalSystemRollMemory(args);
  }

  startTemporalSystemRollBatch(args: Parameters<typeof memory.startTemporalSystemRollBatch>[0]) {
    return memory.startTemporalSystemRollBatch(args);
  }

  getTemporalSystemRollBatchStatus() {
    return memory.getTemporalSystemRollBatchStatus();
  }

  countSemanticMemory(): Promise<{ index_rows: number }> {
    return memory.countSemanticMemoryRows(this.runtimeDeps());
  }

  listSemanticMemories(args?: Parameters<typeof memory.listSemanticMemories>[1]) {
    return memory.listSemanticMemories(this.runtimeDeps(), args);
  }

  listSemanticMemoryClusters() {
    return memory.listSemanticMemoryClusters(this.runtimeDeps());
  }

  updateSemanticMemoryPinned(id: number | string, pinned: boolean) {
    return memory.updateSemanticMemoryPinned(this.runtimeDeps(), id, pinned);
  }

  getFtsStatus(): Promise<fts.FtsStatusSnapshot> {
    return fts.getFtsStatus(this.runtimeDeps());
  }

  startRebuildFtsIndex(opts?: { onlyMissing?: boolean }): fts.FtsRebuildJobStatus {
    return fts.startRebuildFtsIndex(opts);
  }

  getRebuildFtsJobStatus(): fts.FtsRebuildJobStatus {
    return fts.getRebuildFtsJobStatus();
  }

  listSelfBlocks(agentSubjectId: number): Promise<{ blocks: selfLayer.SelfBlockDisplay[] }> {
    return selfLayer.listSelfBlocks(this.runtimeDeps(), agentSubjectId);
  }

  getPromptDebug(conversationId?: string | null): Promise<promptDebug.PromptDebugResponse> {
    return promptDebug.getPromptDebug(this.runtimeDeps(), conversationId);
  }

  getConfig(): SafeConfigSnapshot {
    return status.getConfig(this.runtimeDeps());
  }

  listToolsApi(scope?: "default" | "all") {
    return status.listToolsApi(this.runtimeDeps(), scope);
  }

  listCronJobs(): Promise<{ jobs: CronJobData[] }> {
    return status.listCronJobs();
  }

  pauseCronJob(jobId: string): Promise<CronJobData | null> {
    return status.pauseCronJob(jobId);
  }

  resumeCronJob(jobId: string): Promise<CronJobData | null> {
    return status.resumeCronJob(jobId);
  }

  runCronJobNow(jobId: string): Promise<{ job: CronJobData; message: string } | null> {
    return status.runCronJobNow(jobId);
  }

  createCronJob(opts: {
    name: string;
    schedule: string;
    prompt: string;
    subject_id: number;
    notify_on_success?: boolean;
  }): Promise<CronJobData> {
    return status.createCronJob(opts);
  }

  deleteCronJob(jobId: string): Promise<boolean> {
    return status.deleteCronJob(jobId);
  }

  getMemoryMaintenanceSummary() {
    return memoryMaintenance.getMemoryMaintenanceSummary();
  }

  listCronLogs(opts?: Parameters<typeof memoryMaintenance.listCronLogs>[1]) {
    return memoryMaintenance.listCronLogs(this.runtimeDeps(), opts);
  }

  getMemoryMaintenanceStatus() {
    return memoryMaintenance.getMemoryMaintenanceStatus();
  }

  startMemoryMaintenanceCycle(
    opts?: Parameters<typeof memoryMaintenance.startMemoryMaintenanceCycle>[1],
  ) {
    return memoryMaintenance.startMemoryMaintenanceCycle(this.runtimeDeps(), opts);
  }

  startMemoryMaintenanceStep(
    opts: Parameters<typeof memoryMaintenance.startMemoryMaintenanceStep>[1],
  ) {
    return memoryMaintenance.startMemoryMaintenanceStep(this.runtimeDeps(), opts);
  }

  startMemoryMaintenanceCatchUp(
    opts?: Parameters<typeof memoryMaintenance.startMemoryMaintenanceCatchUp>[1],
  ) {
    return memoryMaintenance.startMemoryMaintenanceCatchUp(this.runtimeDeps(), opts);
  }

  listAutoLlmRuns(opts?: Parameters<typeof autoLlmRuns.listAutoLlmRuns>[1]) {
    return autoLlmRuns.listAutoLlmRuns(this.runtimeDeps(), opts);
  }

  getAutoLlmRun(id: string) {
    return autoLlmRuns.getAutoLlmRunDetail(this.runtimeDeps(), id);
  }

  getUsageToday() {
    return llmUsage.getUsageToday(this.runtimeDeps());
  }

  ensureBuiltinCronJobs(): Promise<void> {
    return status.ensureBuiltinCronJobsRegistered();
  }

  listCommands(opts?: { platform?: string; all?: boolean }) {
    return status.listCommands(opts);
  }

  getStatus(): Record<string, unknown> {
    return { platforms: this.platformStatus };
  }
}

export function createAppRuntime(input: CreateAppRuntimeInput): AppRuntime {
  return new AppRuntime(input);
}

export async function appendConversationMetaForEngine(
  deps: RuntimeDeps,
  conversationId: string,
): Promise<void> {
  return conversations.appendConversationMetaForEngine(deps, conversationId);
}
