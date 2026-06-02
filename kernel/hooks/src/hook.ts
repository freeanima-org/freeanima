/** Hook 身份 token；仅通过 createHook 创建 */
export abstract class Hook<Payload> {
  /** @internal 携带 Payload 泛型，运行时不使用 */
  protected declare readonly _payloadBrand?: Payload;

  readonly id: symbol;
  readonly qualifiedId: string;
  readonly description?: string;

  protected constructor(qualifiedId: string, description?: string) {
    this.id = Symbol(qualifiedId);
    this.qualifiedId = qualifiedId;
    if (description !== undefined) {
      this.description = description;
    }
  }
}

class HookToken<Payload> extends Hook<Payload> {
  constructor(qualifiedId: string, description?: string) {
    super(qualifiedId, description);
  }
}

/** 创建 Hook token；qualifiedId 为唯一标识，description 仅用于展示或文档 */
export function createHook<Payload>(
  qualifiedId: string,
  description?: string,
): Hook<Payload> {
  return new HookToken(qualifiedId, description);
}

