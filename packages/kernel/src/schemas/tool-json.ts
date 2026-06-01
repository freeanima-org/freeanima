import { z } from "zod";

export const toolErrorSchema = z.object({
  error: z.string().min(1),
});

export type ToolErrorResult = z.infer<typeof toolErrorSchema>;

export const toolArgsSchema = z.record(z.string(), z.unknown());

export type ToolArgs = z.infer<typeof toolArgsSchema>;
