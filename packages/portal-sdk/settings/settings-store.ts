import type { SettingsStorageScope } from "./scopes.ts";

/** 泛型配置存储 — 每实例绑定单一 scope */
export type SettingsStore<T = unknown> = {
  readonly scope: SettingsStorageScope;
  load(): Promise<T>;
  save(value: T): Promise<void>;
  test?(value: T): Promise<void>;
};

export type ScopedSettingsBackend = {
  load(scope: SettingsStorageScope): Promise<unknown>;
  save(scope: SettingsStorageScope, value: unknown): Promise<void>;
};

export function createScopedSettingsStore<T>(opts: {
  scope: SettingsStorageScope;
  backend: ScopedSettingsBackend;
  /** 将后端 unknown 解析为 T（必填，避免裸 `as T`） */
  parseLoad: (raw: unknown) => T;
  normalizeSave?: (value: T) => T;
  test?: (value: T) => Promise<void>;
}): SettingsStore<T> {
  const parseLoad = opts.parseLoad;
  const normalizeSave = opts.normalizeSave ?? ((value: T) => value);
  return {
    scope: opts.scope,
    async load() {
      const raw = await opts.backend.load(opts.scope);
      return parseLoad(raw);
    },
    async save(value: T) {
      await opts.backend.save(opts.scope, normalizeSave(value));
    },
    ...(opts.test ? { test: opts.test } : {}),
  };
}
