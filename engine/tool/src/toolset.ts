export type ToolSet = {
  name: string;
  description: string;
  tools: readonly string[];
};

/** ToolSet 注册表；只允许注册一次，之后不可修改 */
export class ToolSetRegistry {
  private readonly registry = new Map<string, ToolSet>();

  register(name: string, description: string, tools: string[]): void {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("ToolSet name is required");
    if (this.registry.has(trimmed)) {
      throw new Error(`ToolSet '${trimmed}' already registered`);
    }
    const toolSet: ToolSet = Object.freeze({
      name: trimmed,
      description,
      tools: Object.freeze([...tools]),
    });
    this.registry.set(trimmed, toolSet);
  }

  get(name: string): ToolSet | undefined {
    return this.registry.get(name.trim());
  }

  list(): ToolSet[] {
    return [...this.registry.values()];
  }
}

/** 全局默认 ToolSet 注册表 */
export const defaultToolSetRegistry = new ToolSetRegistry();

export function registerToolSet(name: string, description: string, tools: string[]): void {
  defaultToolSetRegistry.register(name, description, tools);
}

export function getToolSet(name: string): ToolSet | undefined {
  return defaultToolSetRegistry.get(name);
}

export function listToolSets(): ToolSet[] {
  return defaultToolSetRegistry.list();
}
