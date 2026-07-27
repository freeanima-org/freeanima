import { z } from "zod";

export const eventbusConfigSchema = z
  .object({
    backend: z.enum(["redis"]).optional(),
    key_prefix: z.string().min(1).optional(),
  })
  .optional();

export type EventbusConfigInput = z.infer<typeof eventbusConfigSchema>;
