import { omitUndefined } from "@freeanima/habitat/core/util";
import type { LlmTurnMessage, OpenAiToolSchema } from "./messages.ts";
import type { ChatCompletion, ChatRequest, ChatStreamEvent } from "./invoke.ts";
import type { LlmCallParams } from "./model.ts";
import type { LlmProvider, ProviderRegistry } from "./provider.ts";
import { shouldFailoverToNextHop, withLlmRouteContext, type ProviderError } from "./errors.ts";

export const PROFILE_CHAT = "chat";
export const PROFILE_REFLECT = "reflect";
export const PROFILE_SUMMARY = "summary";
export const PROFILE_GOAL_JUDGE = "goal_judge";
export const PROFILE_SKILL_REVIEW = "skill_review";

export const BUILTIN_PROFILE_IDS = [
  PROFILE_CHAT,
  PROFILE_REFLECT,
  PROFILE_SUMMARY,
  PROFILE_GOAL_JUDGE,
  PROFILE_SKILL_REVIEW,
] as const;

/** One hop in profile chain; later hops are standby routes on failover-eligible failures */
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
  /** Override chain[0].model (e.g. conversation meta.model) */
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
  return omitUndefined({ provider, model, params });
}

export function profileDef(
  id: string,
  chain: RouteHopSpec[],
  params?: Partial<LlmCallParams>,
): LlmProfileDef {
  return omitUndefined({ id, chain, params });
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
    if (profile.chain.length === 0) {
      issues.push({ profileId: profile.id, hopIndex: -1, message: "chain cannot be empty" });
      continue;
    }
    profile.chain.forEach((hopSpec, hopIndex) => {
      if (!hopSpec.provider) {
        issues.push({ profileId: profile.id, hopIndex, message: "hop.provider cannot be empty" });
      } else if (!providers.has(hopSpec.provider)) {
        issues.push({
          profileId: profile.id,
          hopIndex,
          message: `provider "${hopSpec.provider}" is not registered`,
        });
      }
      if (!hopSpec.model) {
        issues.push({ profileId: profile.id, hopIndex, message: "hop.model cannot be empty" });
      }
    });
  }

  return { ok: issues.length === 0, issues };
}

export function assertProfilesValid(profiles: LlmProfileDef[], providers: ProviderRegistry): void {
  const result = validateProfiles(profiles, providers);
  if (!result.ok) {
    const detail = result.issues
      .map((i) => `${i.profileId}[${i.hopIndex}]: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid profile config: ${detail}`);
  }
}

/**
 * Profile entity: holds def + bound provider/model/params; invoke delegates to Backend.
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
      throw new Error(`profile "${this.def.id}" is not bound yet`);
    }
    return this._provider;
  }

  get model(): string {
    return this._model;
  }

  get params(): LlmCallParams {
    return this._params;
  }

  /** Bind chain[0] (session model override applies to first hop only). */
  async bind(options: ProfileBindOptions = {}): Promise<void> {
    await this.bindHop(0, options);
  }

  /** Bind a chain hop: materialize provider + merge params + prepareParams */
  async bindHop(hopIndex: number, options: ProfileBindOptions = {}): Promise<void> {
    const hopSpec = this.def.chain[hopIndex];
    if (!hopSpec) {
      if (hopIndex === 0) {
        throw new Error(`profile "${this.def.id}" chain cannot be empty`);
      }
      throw new Error(`profile "${this.def.id}" chain hop ${hopIndex} is missing`);
    }

    // Conversation/session model override only applies to the primary hop.
    const model = hopIndex === 0 ? (options.model ?? hopSpec.model) : hopSpec.model;
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
    return omitUndefined({
      messages,
      systemPrompt: opts?.systemPrompt,
      params: this._params,
      tools: opts?.tools,
    });
  }

  private enrichFailure(err: unknown, hopIndex: number): ProviderError {
    const mapped = this.provider.reportFailure(err, this._model);
    return withLlmRouteContext(mapped, {
      profileId: this.def.id,
      providerId: this.provider.id,
      model: this._model,
      hopIndex,
    });
  }

  async chat(messages: LlmTurnMessage[], opts?: ProfileChatOptions): Promise<ChatCompletion> {
    let lastError: ProviderError | undefined;
    for (let hopIndex = 0; hopIndex < this.def.chain.length; hopIndex++) {
      await this.bindHop(hopIndex, opts);
      const p = this.provider;
      const request = this.buildRequest(messages, opts);
      try {
        const out = await p.formatForModel(this._model).chat(this._model, request, p.context);
        p.markHealthy();
        return out;
      } catch (err) {
        lastError = this.enrichFailure(err, hopIndex);
        const canFailover =
          hopIndex + 1 < this.def.chain.length && shouldFailoverToNextHop(lastError);
        if (!canFailover) {
          throw lastError;
        }
      }
    }
    throw lastError ?? new Error(`profile "${this.def.id}" chain cannot be empty`);
  }

  async *chatStream(
    messages: LlmTurnMessage[],
    opts?: ProfileChatOptions,
  ): AsyncIterable<ChatStreamEvent> {
    let lastError: ProviderError | undefined;
    for (let hopIndex = 0; hopIndex < this.def.chain.length; hopIndex++) {
      await this.bindHop(hopIndex, opts);
      const p = this.provider;
      const request = this.buildRequest(messages, opts);
      let yielded = false;
      try {
        for await (const event of p
          .formatForModel(this._model)
          .chatStream(this._model, request, p.context)) {
          yielded = true;
          yield event;
        }
        p.markHealthy();
        return;
      } catch (err) {
        lastError = this.enrichFailure(err, hopIndex);
        // Mid-stream failure cannot safely restart on another hop (partial tokens already sent).
        const canFailover =
          !yielded && hopIndex + 1 < this.def.chain.length && shouldFailoverToNextHop(lastError);
        if (!canFailover) {
          throw lastError;
        }
      }
    }
    throw lastError ?? new Error(`profile "${this.def.id}" chain cannot be empty`);
  }
}

/** 空 ProfileRegistry（Habitat 可先启动，设置页配置后再重启） */
export const LLM_PROFILES_UNCONFIGURED_MESSAGE =
  "LLM 未配置；请在 Shell 设置 → Habitat 服务中配置 LLM 后重启服务";

/** Resolve and return LlmProfile entities only */
export class ProfileRegistry {
  private readonly profiles = new Map<string, LlmProfile>();

  constructor(
    defs: LlmProfileDef[],
    readonly defaultProfileId: string,
    providers: ProviderRegistry,
  ) {
    for (const def of defs) {
      if (this.profiles.has(def.id)) {
        throw new Error(`Duplicate profile id: ${def.id}`);
      }
      this.profiles.set(def.id, new LlmProfile(def, providers));
    }
    if (this.profiles.size === 0) {
      return;
    }
    if (!this.profiles.has(defaultProfileId)) {
      throw new Error(`default profile "${defaultProfileId}" is not defined`);
    }
  }

  resolve(profileId?: string): LlmProfile {
    if (this.profiles.size === 0) {
      throw new Error(LLM_PROFILES_UNCONFIGURED_MESSAGE);
    }
    const id = profileId !== undefined ? profileId : this.defaultProfileId;
    const profile = this.profiles.get(id);
    if (profile) return profile;
    if (id !== this.defaultProfileId) {
      const fallback = this.profiles.get(this.defaultProfileId);
      if (fallback) return fallback;
    }
    throw new Error(`Profile not found: ${id}`);
  }

  get default(): LlmProfile {
    return this.resolve();
  }

  list(): LlmProfile[] {
    return [...this.profiles.values()];
  }
}
