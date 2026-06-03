import { Hook } from "./hook";

export type PayloadOf<H> = H extends Hook<infer P> ? P : never;

export type HookHandler<H extends Hook<unknown>> = (
  payload: PayloadOf<H>,
) => void | Promise<void>;
