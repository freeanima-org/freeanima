import type { CredentialPermission, Mask } from "./types.ts";

function freezeMask(mask: Mask): Mask {
  return Object.freeze({
    inherits: Object.freeze([...mask.inherits]) as string[],
    allowed_tools: Object.freeze([...mask.allowed_tools]) as string[],
    denied_tools: Object.freeze([...mask.denied_tools]) as string[],
    auto_skills: Object.freeze([...mask.auto_skills]) as string[],
    credentials: Object.freeze(
      mask.credentials.map((c) =>
        Object.freeze({
          name: c.name,
          read: c.read,
          write: c.write,
        }),
      ),
    ) as CredentialPermission[],
  });
}

/** Named mask registry; frozen on register, cannot modify or delete */
export class MaskRegistry {
  private readonly masks = new Map<string, Mask>();

  register(name: string, mask: Mask): void {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Mask name is required");
    if (this.masks.has(trimmed)) {
      throw new Error(`Mask '${trimmed}' already registered`);
    }
    this.masks.set(trimmed, freezeMask(mask));
  }

  get(name: string): Mask | undefined {
    return this.masks.get(name.trim());
  }

  list(): { name: string; mask: Mask }[] {
    return [...this.masks.entries()].map(([name, mask]) => ({ name, mask }));
  }
}
