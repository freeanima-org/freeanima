import { z } from "zod";

export const jsonRpcMessageSchema = z
  .object({
    jsonrpc: z.string().optional(),
    id: z.union([z.number(), z.string(), z.null()]).optional(),
    method: z.string().optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    result: z.unknown().optional(),
    error: z
      .object({
        code: z.number().optional(),
        message: z.string().optional(),
        data: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type JsonRpcMessage = z.infer<typeof jsonRpcMessageSchema>;
