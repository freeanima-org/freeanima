/** 内存 runtime 配置容器（无文件 I/O）；bootstrap 不进入此对象 */

let activeRuntimeConfig: Config | null = null;

export class Config<T extends Record<string, unknown> = Record<string, unknown>> {
  constructor(protected snapshot: T) {}

  /** 当前 runtime 配置快照 */
  get data(): T {
    return this.snapshot;
  }

  /** 替换内存快照（reload / 测试注入 / patch） */
  update(snapshot: T): void {
    this.snapshot = snapshot;
  }
}

/** Composition root：在 engine 机制运行前绑定 runtime config */
export function bindActiveRuntimeConfig(config: Config): void {
  activeRuntimeConfig = config;
}

export function getActiveRuntimeConfig(): Config {
  if (!activeRuntimeConfig) {
    throw new Error(
      "Active runtime config not bound; call bindActiveRuntimeConfig() or createEngine() first",
    );
  }
  return activeRuntimeConfig;
}

/** 非抛错 peek（早期 bind / 单测） */
export function peekActiveRuntimeConfig(): Config | null {
  return activeRuntimeConfig;
}

/** 单测隔离 */
export function resetActiveConfigForTest(): void {
  activeRuntimeConfig = null;
}
