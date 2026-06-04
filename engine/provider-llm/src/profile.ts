import type { LlmTurnMessage, OpenAiToolSchema } from "@freeanima/legacy-db";
import type { ChatCompletion, ChatRequest, ChatStreamEvent } from "./invoke.js";
import type { LlmCallParams } from "./model.js";
import type { LlmProvider, ProviderRegistry } from "./provider.js";

export const PROFILE_CHAT = "chat";
export const PROFILE_REFLECT = "reflect";
export const PROFILE_SUMMARY = "summary";

export const BUILTIN_PROFILE_IDS = [PROFILE_CHAT, PROFILE_REFLECT, PROFILE_SUMMARY] as const;

/** profile chain 中的一跳；config 可配置多跳 fallback，运行时仅用 chain[0] */
export type RouteHopSpec = {
  provider: string;
  model: string;
  params?: Partial<LlmCallParams>;
};

export type LlmProfileDef = {
  id: string;
  chain: RouteHopSpec[];
  params?: Partial<LlmCallParams>;
};

export type ProfileBindOptions = {
  /** 覆盖 chain[0].model（如 session meta.model） */
  model?: string;
  requestParams?: Partial<LlmCallParams>;
};

export type ProfileChatOptions = ProfileBindOptions & {
  systemPrompt?: string;
  tools?: OpenAiToolSchema[];
};

export function hop(
  provider: string,
  model: string,
  params?: Partial<LlmCallParams>,
): RouteHopSpec {
  return { provider, model, params };
}

export function profileDef(
  id: string,
  chain: RouteHopSpec[],
  params?: Partial<LlmCallParams>,
): LlmProfileDef {
  return { id, chain, params };
}

export function collectProviderIds(profiles: LlmProfileDef[]): string[] {
  const ids = new Set<string>();
  for (const profile of profiles) {
    for (const hopSpec of profile.chain) {
      ids.add(hopSpec.provider);
    }
  }
  return [...ids];
}

export type ProfileValidationIssue = {
  profileId: string;
  hopIndex: number;
  message: string;
};

export type ProfileValidationResult = {
  ok: boolean;
  issues: ProfileValidationIssue[];
};

export function validateProfiles(
  profiles: LlmProfileDef[],
  providers: ProviderRegistry,
): ProfileValidationResult {
  const issues: ProfileValidationIssue[] = [];

  for (const profile of profiles) {
    if (!profile.chain.length) {
      issues.push({ profileId: profile.id, hopIndex: -1, message: "chain 不能为空" });
      continue;
    }
    profile.chain.forEach((hopSpec, hopIndex) => {
      if (!hopSpec.provider) {
        issues.push({ profileId: profile.id, hopIndex, message: "hop.provider 不能为空" });
      } else if (!providers.has(hopSpec.provider)) {
        issues.push({ profileId: profile.id, hopIndex, message: `provider "${hopSpec.provider}" 未注册` });
      }
      if (!hopSpec.model) {
        issues.push({ profileId: profile.id, hopIndex, message: "hop.model 不能为空" });
      }
    });
  }

  return { ok: issues.length === 0, issues };
}

export function assertProfilesValid(
  profiles: LlmProfileDef[],
  providers: ProviderRegistry,
): void {
  const result = validateProfiles(profiles, providers);
  if (!result.ok) {
    const detail = result.issues.map((i) => `${i.profileId}[${i.hopIndex}]: ${i.message}`).join("; ");
    throw new Error(`profile 配置无效: ${detail}`);
  }
}

/**
 * Profile 实体：持 def + 绑定后的 provider/model/params；invoke 直委托 Backend。
 */
export class LlmProfile {
  private _provider: LlmProvider | null = null;
  private _model = "";
  private _params: LlmCallParams = {};
  constructor(
    readonly def: LlmProfileDef,
    private readonly providers: ProviderRegistry,
  ) {}

  get id(): string {
    return this.def.id;
  }

  get provider(): LlmProvider {
    if (!this._provider) {
      throw new Error(`profile "${this.def.id}" 尚未 bind`);
    }
    return this._provider;
  }

  get model(): string {
    return this._model;
  }

  get params(): LlmCallParams {
    return this._params;
  }

  /** 绑定 chain[0]：materialize provider + merge params + prepareParams */
  async bind(options: ProfileBindOptions = {}): Promise<void> {
    const hopSpec = this.def.chain[0];
    if (!hopSpec) {
      throw new Error(`profile "${this.def.id}" chain 不能为空`);
    }

    const model = options.model ?? hopSpec.model;
    const provider = this.providers.get(hopSpec.provider);
    const params = await provider.prepareParams(
      model,
      this.def.params ?? {},
      hopSpec.params ?? {},
      options.requestParams ?? {},
    );

    this._provider = provider;
    this._model = model;
    this._params = params;
  }

  private buildRequest(messages: LlmTurnMessage[], opts?: ProfileChatOptions): ChatRequest {
    return {
      messages,
      systemPrompt: opts?.systemPrompt,
      params: this._params,
      tools: opts?.tools,
    };
  }

  async chat(messages: LlmTurnMessage[], opts?: ProfileChatOptions): Promise<ChatCompletion> {
    await this.bind(opts);
    const p = this.provider;
    const request = this.buildRequest(messages, opts);
    try {
      const out = await p.backend.chat(this._model, request, p.context);
      p.markHealthy();
      return out;
    } catch (err) {
      throw p.reportFailure(err);
    }
  }

  async *chatStream(
    messages: LlmTurnMessage[],
    opts?: ProfileChatOptions,
  ): AsyncIterable<ChatStreamEvent> {
    await this.bind(opts);
    const p = this.provider;
    const request = this.buildRequest(messages, opts);
    try {
      for await (const event of p.backend.chatStream(this._model, request, p.context)) {
        yield event;
      }
      p.markHealthy();
    } catch (err) {
      throw p.reportFailure(err);
    }
  }

}

/** 仅负责解析并返回 LlmProfile 实体 */
export class ProfileRegistry {
  private readonly profiles = new Map<string, LlmProfile>();

  constructor(
    defs: LlmProfileDef[],
    readonly defaultProfileId: string,
    providers: ProviderRegistry,
  ) {
    for (const def of defs) {
      if (this.profiles.has(def.id)) {
        throw new Error(`重复的 profile id: ${def.id}`);
      }
      this.profiles.set(def.id, new LlmProfile(def, providers));
    }
    if (!this.profiles.has(defaultProfileId)) {
      throw new Error(`default profile "${defaultProfileId}" 未定义`);
    }
  }

  resolve(profileId?: string): LlmProfile {
    const id = profileId !== undefined ? profileId : this.defaultProfileId;
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`未找到 profile: ${id}`);
    }
    return profile;
  }

  get default(): LlmProfile {
    return this.resolve();
  }

  list(): LlmProfile[] {
    return [...this.profiles.values()];
  }
}
