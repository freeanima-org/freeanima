import { initTRPC, TRPCError } from "@trpc/server";
import { ApiHandlerError } from "../handlers/errors.ts";
import type { TrpcContext } from "./context.ts";

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure.use(async ({ next }) => {
  try {
    return await next();
  } catch (e) {
    if (e instanceof ApiHandlerError) {
      const code =
        e.status === 404
          ? "NOT_FOUND"
          : e.status === 400
            ? "BAD_REQUEST"
            : e.status === 503
              ? "SERVICE_UNAVAILABLE"
              : "INTERNAL_SERVER_ERROR";
      throw new TRPCError({ code, message: e.message });
    }
    throw e;
  }
});
