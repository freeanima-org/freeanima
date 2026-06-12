import type { StreamEvent } from "@freeanima/orchestration-loop";

/** Narrow AnimaService interface for Gateway / platform adapters */
export type ServiceCommandInfo = {
  name: string;
  description: string;
  scope?: string;
  hidden?: boolean;
  platforms?: string[] | null;
};

export type AnimaService = {
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
};
