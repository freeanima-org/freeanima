import type { AnimaService } from "./anima-service.ts";

/** WebUI / 状态 API 所需的运行时服务窄接口（Gateway 接口的超集） */
export type RuntimeService = AnimaService & {
  isShuttingDown(): boolean;
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
  getSessionInfo(sessionId: string, platform: string): Promise<any>;
  getMessages(sessionId: string, platform: string, opts?: { offset?: number; limit?: number }): any;
  setSessionTitle(sessionId: string, title: string, platform: string): Promise<any>;
  getStatus(): Record<string, unknown>;
  listMemoryFiles(): any;
  memorySearch(opts: any): Promise<any>;
  countSemanticMemory(): any;
  listSemanticMemories(opts?: any): Promise<any>;
  listLimbicMemories(opts?: any): Promise<any>;
  listAutobiographicalMemories(opts?: any): Promise<any>;
  getFtsStatus(): Promise<any>;
  startRebuildFtsIndex(opts?: { onlyMissing?: boolean }): any;
  getRebuildFtsJobStatus(): any;
  listSelfBlocks(): Promise<any>;
  getPromptDebug(sessionId?: string | null): Promise<any>;
};

export type { AnimaService, ServiceCommandInfo } from "./anima-service.ts";
