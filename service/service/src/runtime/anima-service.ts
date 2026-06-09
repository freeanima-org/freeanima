import type { EventBus } from "@freeanima/kernel-eventbus";
import type {
  HealthSnapshot,
  PlatformStatusSnapshot,
  SafeConfigSnapshot,
  ServiceSnapshot,
  SessionSummary,
} from "@freeanima/service/schemas/snapshot";
import type { StreamEvent } from "@freeanima/engine-loop";
import type { SessionMessage as Message } from "@freeanima/engine-db/domain";
import type { ConversationService } from "@freeanima/engine-conversation";
import type { CronJobData } from "@freeanima/connectors-cron";
import type { Kernel } from "@freeanima/kernel";
import { collectStreamReply } from "@freeanima/engine-loop";
import { createTurnMessageCallbacks, type StreamTurnHost } from "./turn-lifecycle.ts";
import { EngineRunControl } from "./engine-run-control.ts";
import { SessionManager } from "./session-manager.ts";
import * as status from "./service-status.ts";
import * as sessions from "./service-sessions.ts";
import * as memory from "./service-memory.ts";
import * as selfLayer from "./service-self.ts";
import * as fts from "./service-fts.ts";
import * as promptDebug from "./service-prompt-debug.ts";
import * as sleep from "./service-sleep.ts";
import * as messaging from "./service-messaging.ts";
import { PARLOR_PLATFORM } from "./platforms.ts";

export type { MemoryFileEntry } from "./service-memory.ts";
export type { StreamEvent } from "@freeanima/engine-loop";
export { SessionManager } from "./session-manager.ts";

export class AnimaService implements StreamTurnHost {
  private startTime = 0;
  private platformStatus: Record<string, PlatformStatusSnapshot> = {};
  private readonly runControl = new EngineRunControl();
  private readonly sessionManager = new SessionManager();
  private bus: EventBus | null = null;
  private onSessionUpdated: ((sid: string) => void) | null = null;

  constructor(
    private readonly deps: {
      kernel: Kernel;
      conversation: ConversationService;
    },
  ) {}

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
      hookRegistry: this.deps.kernel.hookRegistry,
      ...createTurnMessageCallbacks(sessionId),
      signal,
      shouldStop: () => this.runControl.isShuttingDown(),
    };
  }

  async reloadRuntimeAfterRepair(sessionId: string): Promise<[Message[], string[]]> {
    const { conversation } = this.deps;
    await conversation.repairAndPersistToolLoop(sessionId, await conversation.load(sessionId));
    return conversation.buildRuntimeMessages(sessionId);
  }

  async onTurnAfterComplete(sessionId: string, msgs: Message[], reply: string): Promise<string> {
    return messaging.runTurnAfterCompleteHooks(sessionId, msgs, reply);
  }

  emitSessionUpdated(sessionId: string): void {
    messaging.emitSessionUpdated(
      { bus: this.bus, onSessionUpdated: this.onSessionUpdated },
      sessionId,
    );
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
      this.startTime,
      this.platformStatus,
      cronJobs.jobs.length,
      host,
      port,
    );
  }

  listSessions(platform?: string | null): Promise<{ sessions: SessionSummary[] }> {
    return sessions.listSessions(platform);
  }

  createSession(platform = PARLOR_PLATFORM): Promise<{ session_id: string }> {
    return sessions.createSession(platform);
  }

  findOrCreateSession(
    platform: string,
    platform_extra: Record<string, unknown> = {},
  ): Promise<{ session_id: string }> {
    return sessions.findOrCreateSession(platform, platform_extra);
  }

  patchSessionOrigin(
    session_id: string,
    platform: string,
    platform_extra?: Record<string, unknown>,
  ): Promise<{ ok: boolean }> {
    return sessions.patchSessionOrigin(session_id, platform, platform_extra);
  }

  executeCommand(params: {
    session_id: string;
    text: string;
    platform?: string;
    origin_extra?: Record<string, unknown>;
  }): Promise<{ text: string; data: unknown; found: boolean }> {
    return messaging.executeCommand(this.messagingDeps(), params);
  }

  getSessionInfo(sessionId: string, platform = ""): Promise<Record<string, unknown>> {
    return sessions.getSessionInfo(sessionId, platform);
  }

  getMessages(sessionId: string, platform = "", opts?: { offset?: number; limit?: number | null }) {
    return sessions.getMessages(sessionId, platform, opts);
  }

  setSessionTitle(sessionId: string, title: string, platform = ""): Promise<{ ok: boolean }> {
    return sessions.setSessionTitle(sessionId, title, platform);
  }

  async sendMessage(
    sessionId: string,
    message: string,
    platform = PARLOR_PLATFORM,
  ): Promise<{ session_id: string; content: string }> {
    const content = await collectStreamReply(
      messaging.sendMessageStream(this.messagingDeps(), sessionId, message, platform),
    );
    return { session_id: sessionId, content };
  }

  sendMessageStream(
    sessionId: string,
    message: string,
    platform = PARLOR_PLATFORM,
  ): AsyncGenerator<StreamEvent> {
    return messaging.sendMessageStream(this.messagingDeps(), sessionId, message, platform);
  }

  memorySearch(args: { query: string; limit?: number; session_limit?: number; session?: string }) {
    return memory.memorySearch(args);
  }

  countSemanticMemory(): Promise<{ index_rows: number }> {
    return memory.countSemanticMemory();
  }

  listMemoryFiles(): Promise<{ files: memory.MemoryFileEntry[] }> {
    return memory.listMemoryFiles();
  }

  listSemanticMemories(args?: Parameters<typeof memory.listSemanticMemories>[0]) {
    return memory.listSemanticMemories(args);
  }

  listLimbicMemories(args?: Parameters<typeof memory.listLimbicMemories>[0]) {
    return memory.listLimbicMemories(args);
  }

  listAutobiographicalMemories(args?: Parameters<typeof memory.listAutobiographicalMemories>[0]) {
    return memory.listAutobiographicalMemories(args);
  }

  getFtsStatus(): Promise<fts.FtsStatusSnapshot> {
    return fts.getFtsStatus();
  }

  startRebuildFtsIndex(opts?: { onlyMissing?: boolean }): fts.FtsRebuildJobStatus {
    return fts.startRebuildFtsIndex(opts);
  }

  getRebuildFtsJobStatus(): fts.FtsRebuildJobStatus {
    return fts.getRebuildFtsJobStatus();
  }

  listSelfBlocks(): Promise<{ blocks: selfLayer.SelfBlockDisplay[] }> {
    return selfLayer.listSelfBlocks();
  }

  getPromptDebug(sessionId?: string | null): Promise<promptDebug.PromptDebugResponse> {
    return promptDebug.getPromptDebug(sessionId);
  }

  getConfig(): SafeConfigSnapshot {
    return status.getConfig();
  }

  listToolsApi() {
    return status.listToolsApi();
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

  listSleepRuns(opts?: Parameters<typeof sleep.listSleepRuns>[0]) {
    return sleep.listSleepRuns(opts);
  }

  listCronLogs(opts?: Parameters<typeof sleep.listCronLogs>[0]) {
    return sleep.listCronLogs(opts);
  }

  getDeepSleepRounds(day: string) {
    return sleep.getDeepSleepRounds(day);
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

export async function appendSessionMetaForEngine(session: string): Promise<void> {
  return sessions.appendSessionMetaForEngine(session);
}
