import type { EventBus } from "@freeanima/kernel/eventbus";
import type {
  HealthSnapshot,
  PlatformStatusSnapshot,
  SafeConfigSnapshot,
  ServiceSnapshot,
  ConversationSummary,
} from "@freeanima/platform/schemas/snapshot";
import type { StreamEvent } from "@freeanima/runtime/loop";
import type { StoredMessage as Message } from "@freeanima/core/db/domain";
import type { ConversationService } from "@freeanima/runtime/conversation";
import type { CronJobData } from "@freeanima/platform/connectors/cron";
import type { Kernel } from "@freeanima/kernel";
import type { AppRuntimePort } from "@freeanima/platform/ports/app-runtime-port";
import type { AcpManagerPort } from "@freeanima/platform/ports/acp-manager";
import type { MaskRegistryPort } from "@freeanima/platform/ports/mask-registry";
import type { McpManagerPort } from "@freeanima/platform/ports/mcp-manager";
import type { SatelliteManagerPort } from "@freeanima/platform/ports/satellite-manager";
import type { ServiceEnginePort } from "@freeanima/platform/ports/service-engine";
import { collectStreamReply } from "@freeanima/runtime/loop";
import { createTurnMessageCallbacks, type StreamTurnHost } from "./turn-lifecycle.ts";
import { EngineRunControl } from "./engine-run-control.ts";
import { ConversationManager } from "./conversation-manager.ts";
import type { FullRuntimeDeps, RuntimeDeps } from "./runtime-deps.ts";
import * as status from "./service-status.ts";
import * as conversations from "./service-conversations.ts";
import * as acpDock from "./service-acp-dock.ts";
import * as memory from "./service-memory.ts";
import * as selfLayer from "./service-self.ts";
import * as fts from "./service-fts.ts";
import * as promptDebug from "./service-prompt-debug.ts";
import * as sleep from "./service-sleep.ts";
import * as autoLlmRuns from "./service-auto-llm-runs.ts";
import * as fridge from "./service-fridge.ts";
import * as messaging from "./service-messaging.ts";

export type { MemoryFileEntry } from "./service-memory.ts";
export type { StreamEvent } from "@freeanima/runtime/loop";
export { ConversationManager } from "./conversation-manager.ts";

export type CreateAppRuntimeInput = FullRuntimeDeps;

export class AppRuntime implements StreamTurnHost, AppRuntimePort {
  private startTime = 0;
  private platformStatus: Record<string, PlatformStatusSnapshot> = {};
  private readonly runControl = new EngineRunControl();
  private readonly conversationManager = new ConversationManager();
  private bus: EventBus | null = null;
  private onConversationUpdated: ((sid: string) => void) | null = null;
  private readonly conversationWatchers = new Map<string, Set<() => void>>();

  readonly kernel: Kernel;
  readonly engine: ServiceEnginePort;
  readonly conversation: ConversationService;
  readonly masks: MaskRegistryPort;
  readonly mcp: McpManagerPort | null;
  readonly satellite: SatelliteManagerPort | null;
  readonly acp: AcpManagerPort;
  readonly host: string;
  readonly port: number;

  constructor(input: CreateAppRuntimeInput) {
    this.kernel = input.kernel;
    this.engine = input.engine;
    this.conversation = input.conversation;
    this.masks = input.masks;
    this.mcp = input.mcp;
    this.satellite = input.satellite;
    this.acp = input.acp;
    this.host = input.host;
    this.port = input.port;
  }

  fullDeps(): FullRuntimeDeps {
    return {
      kernel: this.kernel,
      engine: this.engine,
      conversation: this.conversation,
      masks: this.masks,
      mcp: this.mcp,
      satellite: this.satellite,
      acp: this.acp,
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
      bus: this.bus,
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

  engineStreamOpts(conversationId: string, signal: AbortSignal) {
    return {
      hookRegistry: this.kernel.hookRegistry,
      ...createTurnMessageCallbacks(this.fullDeps(), conversationId),
      signal,
      shouldStop: () => this.runControl.isShuttingDown(),
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
      { bus: this.bus, onConversationUpdated: this.onConversationUpdated },
      conversationId,
    );
    this.pokeSessionWatchers(conversationId);
  }

  /** Admin SSE: wake watchers without re-running onConversationUpdated (ACP progress already notified). */
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
  }

  /** Admin SSE: notify when conversation messages/meta change (ACP progress, callbacks). */
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

  setEventBus(bus: EventBus): void {
    this.bus = bus;
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
    return status.health();
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
  }): Promise<{ text: string; data: unknown; found: boolean }> {
    return messaging.executeCommand(this.fullDeps(), this.messagingDeps(), params);
  }

  getConversationInfo(conversationId: string, platform = ""): Promise<Record<string, unknown>> {
    return conversations.getConversationInfo(this.runtimeDeps(), conversationId, platform);
  }

  getConversationAcpDock(conversationId: string, platform = "") {
    return acpDock.getConversationAcpDock(this.runtimeDeps(), conversationId, platform);
  }

  getMessages(
    conversationId: string,
    platform = "",
    opts?: { offset?: number; limit?: number | null },
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

  deleteConversation(conversationId: string, platform = ""): Promise<{ ok: boolean }> {
    return conversations.deleteConversation(this.runtimeDeps(), conversationId, platform);
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

  interruptSessionStream(conversationId: string): void {
    messaging.interruptSessionStream(this.messagingDeps(), conversationId);
  }

  memorySearch(args: { query: string; limit?: number }) {
    return memory.memorySearch(args);
  }

  countSemanticMemory(): Promise<{ index_rows: number }> {
    return memory.countSemanticMemoryRows(this.runtimeDeps());
  }

  listMemoryFiles(): Promise<{ files: memory.MemoryFileEntry[] }> {
    return memory.listMemoryFiles(this.runtimeDeps());
  }

  listSemanticMemories(args?: Parameters<typeof memory.listSemanticMemories>[1]) {
    return memory.listSemanticMemories(this.runtimeDeps(), args);
  }

  updateSemanticMemoryPinned(id: string, pinned: boolean) {
    return memory.updateSemanticMemoryPinned(this.runtimeDeps(), id, pinned);
  }

  listLimbicMemories(args?: Parameters<typeof memory.listLimbicMemories>[1]) {
    return memory.listLimbicMemories(this.runtimeDeps(), args);
  }

  listAutobiographicalMemories(args?: Parameters<typeof memory.listAutobiographicalMemories>[1]) {
    return memory.listAutobiographicalMemories(this.runtimeDeps(), args);
  }

  listDreamMemories(args?: Parameters<typeof memory.listDreamMemories>[1]) {
    return memory.listDreamMemories(this.runtimeDeps(), args);
  }

  getDreamMemoryByDay(day: string) {
    return memory.getDreamMemoryByDayService(this.runtimeDeps(), day);
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

  listSelfBlocks(): Promise<{ blocks: selfLayer.SelfBlockDisplay[] }> {
    return selfLayer.listSelfBlocks(this.runtimeDeps());
  }

  listFridgeMagnets(): Promise<fridge.ListFridgeMagnetsResult> {
    return fridge.listFridgeMagnets();
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

  getSleepSummary() {
    return sleep.getSleepSummary();
  }

  listPipelineStepRuns(opts?: Parameters<typeof sleep.listPipelineStepRuns>[1]) {
    return sleep.listPipelineStepRuns(this.runtimeDeps(), opts);
  }

  listCronLogs(opts?: Parameters<typeof sleep.listCronLogs>[1]) {
    return sleep.listCronLogs(this.runtimeDeps(), opts);
  }

  getDeepSleepRounds(day: string) {
    return sleep.getDeepSleepRounds(day);
  }

  getSleepPipelineStatus() {
    return sleep.getSleepPipelineStatus();
  }

  startSleepCycle(opts?: Parameters<typeof sleep.startSleepCycle>[1]) {
    return sleep.startSleepCycle(this.runtimeDeps(), opts);
  }

  startSleepPipelineStep(opts: Parameters<typeof sleep.startSleepPipelineStep>[1]) {
    return sleep.startSleepPipelineStep(this.runtimeDeps(), opts);
  }

  listAutoLlmRuns(opts?: Parameters<typeof autoLlmRuns.listAutoLlmRuns>[1]) {
    return autoLlmRuns.listAutoLlmRuns(this.runtimeDeps(), opts);
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
