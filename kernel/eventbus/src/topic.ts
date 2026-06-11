import { QualifiedToken } from "@freeanima/kernel-token";

/** Event type token; created only via createEventTopic */
export abstract class EventTopic<Payload> extends QualifiedToken<Payload> {}

class EventTopicToken<Payload> extends EventTopic<Payload> {
  constructor(qualifiedId: string, description?: string) {
    super(qualifiedId, description);
  }
}

/** Create event topic token; qualifiedId unique (persisted topic column); description for display/docs */
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
