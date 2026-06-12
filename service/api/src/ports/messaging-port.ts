import type { StreamEvent } from "@freeanima/runtime/loop";

/** Gateway / 平台消息入口 */
export type MessagingPort = {
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
  registerPlatform(name: string): void;
  updatePlatformStatus(name: string, status: string, extra?: Record<string, unknown>): void;
  waitForDrain(): Promise<void>;
  getInFlightCount(): number;
  abortAll(): void;
  isShuttingDown(): boolean;
  startShutdown(): void;
  listCommands(opts?: { platform?: string; all?: boolean }): {
    commands: Array<{
      name: string;
      description: string;
      scope?: string;
      hidden?: boolean;
      platforms?: string[] | null;
    }>;
  };
};
