import type { AppRuntime } from "../service/app-runtime.ts";
import type { EnginePhaseResult } from "./engine-phase.ts";
import type { IdentityPhaseResult } from "./identity-phase.ts";
import type { PersistencePhaseResult } from "./persistence-phase.ts";
import type { RuntimePhaseResult } from "./runtime-phase.ts";
import type { ServeOptions } from "./types.ts";
import type { WorldSubjectsPhaseResult } from "./world-subjects-phase.ts";

/** Runtime inputs threaded into every boot phase. */
export type BootPipelineConfig = {
  statusHost: string;
  port: number;
  onConversationUpdated: (conversationId: string) => void;
  runtimeRef: { current: AppRuntime | null };
  acpSessionUpdatedRef: { handler: ((sid: string) => void) | null };
  serveOpts: ServeOptions;
};

declare module "cordis" {
  interface Context {
    /** Set by `serve()` before the boot plugin tree is mounted. */
    bootOptions: BootPipelineConfig;
    bootConfig: Record<string, never>;
    bootPersistence: PersistencePhaseResult;
    bootIdentity: IdentityPhaseResult;
    bootWorldSubjects: WorldSubjectsPhaseResult;
    /** 顺序哨兵：config-secrets 阶段完成（无载荷）。 */
    bootConfigSecrets: Record<string, never>;
    /** 顺序哨兵：service-api-tokens 阶段完成（无载荷）。 */
    bootServiceApiTokens: Record<string, never>;
    bootEngine: EnginePhaseResult;
    bootRuntime: RuntimePhaseResult;
  }
}
