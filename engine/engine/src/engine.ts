import type { ToolRegistry } from "@freeanima/engine-tool";
import type {
  BackendRegistry,
  ProfileRegistry,
  ProviderRegistry,
} from "@freeanima/engine-provider-llm";

/** LLM 子组件群（与 legacy llm-stack 的 LlmRuntime 同形） */
export type EngineLlm = {
  backends: BackendRegistry;
  providers: ProviderRegistry;
  profiles: ProfileRegistry;
};

/** 引擎层组合视图 */
export class Engine {
  constructor(
    readonly tools: ToolRegistry,
    readonly llm: EngineLlm,
  ) {}
}
