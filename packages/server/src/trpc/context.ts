import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";
import { assertNotShuttingDown } from "../service-context.ts";

export type TrpcContext = {
  terminalSessionId: string | null;
};

export async function createTrpcContext(
  _opts: FetchCreateContextFnOptions | CreateWSSContextFnOptions,
): Promise<TrpcContext> {
  assertNotShuttingDown();
  return { terminalSessionId: null };
}
