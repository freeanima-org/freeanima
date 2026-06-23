import type { EventBus } from "@freeanima/kernel/eventbus";
import type {
  HealthSnapshot,
  PlatformStatusSnapshot,
  SafeConfigSnapshot,
  ServiceSnapshot,
  SessionSummary,
} from "@freeanima/platform/schemas/snapshot";
import type { StreamEvent } from "@freeanima/runtime/loop";
import type { SessionMessage as Message } from "@freeanima/core/db/domain";
import type { ConversationService } from "@freeanima/runtime/conversation";
import type { CronJobData } from "@freeanima/platform/connectors/cron";
import type { Kernel } from "@freeanima/kernel";
import type { AppRuntimePort } from "@freeanima/platform/ports/app-runtime-port";
import type { AcpManagerPort } from "@freeanima/platform/ports/ports/acp-manager";
import type { MaskRegistryPort } from "@freeanima/platform/ports/ports/mask-registry";
import type { McpManagerPort } from "@freeanima/platform/ports/ports/mcp-manager";
import type { SatelliteManagerPort } from "@freeanima/platform/ports/ports/satellite-manager";
import type { ServiceEnginePort } from "@freeanima/platform/ports/ports/service-engine";
import { collectStreamReply } from "@freeanima/runtime/loop";
import { createTurnMessageCallbacks, type StreamTurnHost } from "./turn-lifecycle.ts";
import { EngineRunControl } from "./engine-run-control.ts";
import { SessionManager } from "./session-manager.ts";
import type { FullRuntimeDeps, RuntimeDeps } from "./runtime-deps.ts";
import * as status from "./service-status.ts";
import * as sessions from "./service-sessions.ts";
import * as acpDock from "./service-acp-dock.ts";
import * as memory from "./service-memory.ts";
import * as selfLayer from "./service-self.ts";
import * as fts from "./service-fts.ts";
import * as promptDebug from "./service-prompt-debug.ts";
import * as sleep from "./service-sleep.ts";
import * as tasks from "./service-tasks.ts";
import * as fridge from "./service-fridge.ts";
import * as messaging from "./service-messaging.ts";

export type { MemoryFileEntry } from "./service-memory.ts";
export type { StreamEvent } from "@freeanima/runtime/loop";
export { SessionManager } from "./session-manager.ts";

export type CreateAppRuntimeInput = FullRuntimeDeps;

export class AppRuntime implements StreamTurnHost, AppRuntimePort {
  private startTime = 0;
  private platformStatus: Record<string, PlatformStatusSnapshot> = {};
  private readonly runControl = new EngineRunControl();
  private readonly sessionManager = new SessionManager();
  private bus: EventBus | null = null;
  private onSessionUpdated: ((sid: string) => void) | null = null;
  private readonly sessionWatchers = new Map<string, Set<() => void>>();

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
      sessionManager: this.sessionManager,
      bus: this.bus,
      onSessionUpdated: this.onSessionUpdated,
      streamHost: this,
    };
  }

  runExclusive<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    return this.sessionManager.runExclusive(sessionId, fn);
  }

  beginEngineRun(sessionId: string): { signal: AbortSignal; controller: AbortController } {
    return this.runControl.beginEngineRun(sessionId);
  }

  endEngineRun(sessionId: string, controller: AbortController): void {
    this.runControl.endEngineRun(sessionId, controller);
  }

  acquireInFlight(): void {
    this.runControl.acquireInFlight();
  }

  releaseInFlight(): void {
    this.runControl.releaseInFlight();
  }

  engineStreamOpts(sessionId: string, signal: AbortSignal) {
    return {
      hookRegistry: this.kernel.hookRegistry,
      ...createTurnMessageCallbacks(this.fullDeps(), sessionId),
      signal,
      shouldStop: () => this.runControl.isShuttingDown(),
    };
  }

  async reloadRuntimeAfterRepair(sessionId: string): Promise<[Message[], string[]]> {
    await this.conversation.repairAndPersistToolLoop(
      sessionId,
      await this.conversation.load(sessionId),
    );
    return this.conversation.buildRuntimeMessages(sessionId);
  }

  async onTurnAfterComplete(sessionId: string, msgs: Message[], reply: string): Promise<string> {
    return messaging.runTurnAfterCompleteHooks(this.fullDeps(), sessionId, msgs, reply);
  }

  emitSessionUpdated(sessionId: string): void {
    messaging.emitSessionUpdated(
      { bus: this.bus, onSessionUpdated: this.onSessionUpdated },
      sessionId,
    );
    this.pokeSessionWatchers(sessionId);
  }

  /** WebUI SSE: wake watchers without re-running onSessionUpdated (ACP progress already notified). */
  pokeSessionWatchers(sessionId: string): void {
    const set = this.sessionWatchers.get(sessionId);
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

  /** WebUI SSE: notify when session messages/meta change (ACP progress, callbacks). */
  watchSession(sessionId: string, cb: () => void): () => void {
    let set = this.sessionWatchers.get(sessionId);
    if (!set) {
      set = new Set();
      this.sessionWatchers.set(sessionId, set);
    }
    set.add(cb);
    return () => {
      set?.delete(cb);
      if (set && !set.size) this.sessionWatchers.delete(sessionId);
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
    this.onSessionUpdated = cb;
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

  listSessions(
    platform?: string | null,
    opts?: { offset?: number; limit?: number },
  ): Promise<{ sessions: SessionSummary[]; total: number }> {
    return sessions.listSessions(this.runtimeDeps(), platform, opts);
  }

  createSession(platform: string): Promise<{ session_id: string }> {
    return sessions.createSession(this.runtimeDeps(), platform);
  }

  findOrCreateSession(
    platform: string,
    platform_extra: Record<string, unknown> = {},
  ): Promise<{ session_id: string }> {
    return sessions.findOrCreateSession(this.runtimeDeps(), platform, platform_extra);
  }

  patchSessionOrigin(
    session_id: string,
    platform: string,
    platform_extra?: Record<string, unknown>,
  ): Promise<{ ok: boolean }> {
    return sessions.patchSessionOrigin(this.runtimeDeps(), session_id, platform, platform_extra);
  }

  executeCommand(params: {
    session_id: string;
    text: string;
    platform?: string;
    origin_extra?: Record<string, unknown>;
  }): Promise<{ text: string; data: unknown; found: boolean }> {
    return messaging.executeCommand(this.fullDeps(), this.messagingDeps(), params);
  }

  getSessionInfo(sessionId: string, platform = ""): Promise<Record<string, unknown>> {
    return sessions.getSessionInfo(this.runtimeDeps(), sessionId, platform);
  }

  getSessionAcpDock(sessionId: string, platform = "") {
    return acpDock.getSessionAcpDock(this.runtimeDeps(), sessionId, platform);
  }

  getMessages(sessionId: string, platform = "", opts?: { offset?: number; limit?: number | null }) {
    return sessions.getMessages(this.runtimeDeps(), sessionId, platform, opts);
  }

  setSessionTitle(sessionId: string, title: string, platform = ""): Promise<{ ok: boolean }> {
    return sessions.setSessionTitle(this.runtimeDeps(), sessionId, title, platform);
  }

  async sendMessage(
    sessionId: string,
    message: string,
    platform?: string,
  ): Promise<{ session_id: string; content: string }> {
    const content = await collectStreamReply(
      messaging.sendMessageStream(
        this.fullDeps(),
        this.messagingDeps(),
        sessionId,
        message,
        platform,
      ),
    );
    return { session_id: sessionId, content };
  }

  sendMessageStream(
    sessionId: string,
    message: string,
    platform?: string,
  ): AsyncGenerator<StreamEvent> {
    return messaging.sendMessageStream(
      this.fullDeps(),
      this.messagingDeps(),
      sessionId,
      message,
      platform,
    );
  }

  interruptSessionStream(sessionId: string): void {
    messaging.interruptSessionStream(this.messagingDeps(), sessionId);
  }

  memorySearch(args: { query: string; limit?: number }) {
    return memory.memorySearch(args);
  }

  countSemanticMemory(): Promise<{ index_rows: number }> {
    return memory.countSemanticMemory(this.runtimeDeps());
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
    return memory.getDreamMemoryByDay(this.runtimeDeps(), day);
  }

  listTasks(args?: Parameters<typeof tasks.listTasks>[1]) {
    return tasks.listTasks(this.runtimeDeps(), args);
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

  getPromptDebug(sessionId?: string | null): Promise<promptDebug.PromptDebugResponse> {
    return promptDebug.getPromptDebug(this.runtimeDeps(), sessionId);
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

export async function appendSessionMetaForEngine(
  deps: RuntimeDeps,
  session: string,
): Promise<void> {
  return sessions.appendSessionMetaForEngine(deps, session);
}
