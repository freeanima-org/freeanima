// --- Event topic token ---

/** 事件类型 token；仅通过 createEventTopic 创建 */
export abstract class EventTopic<Payload> {
  /** @internal 携带 Payload 泛型，运行时不使用 */
  declare protected readonly _payloadBrand?: Payload;

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

class EventTopicToken<Payload> extends EventTopic<Payload> {
  constructor(qualifiedId: string, description?: string) {
    super(qualifiedId, description);
  }
}

/** 创建事件 topic token；qualifiedId 为唯一标识（持久化 topic 列），description 仅用于展示或文档 */
export function createEventTopic<Payload>(
  qualifiedId: string,
  description?: string,
): EventTopic<Payload> {
  return new EventTopicToken(qualifiedId, description);
}

export type PayloadOf<T> = T extends EventTopic<infer P> ? P : never;

export type EventHandler<T extends EventTopic<unknown>> = (
  payload: PayloadOf<T>,
) => void | Promise<void>;
