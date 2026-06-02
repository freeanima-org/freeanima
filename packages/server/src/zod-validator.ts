import { logApiError, formatZodError } from "@freeanima/legacy-kernel";
import { zValidator as zv } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { z } from "zod";


export const zValidator = <
  T extends z.ZodType,
  Target extends keyof ValidationTargets = "json",
>(
  target: Target,
  schema: T,
) =>
  zv(target, schema, (result, c) => {
    if (!result.success) {
      const message = formatZodError(result.error);
      logApiError(c.req.method, c.req.path, 400, message);
      return c.json({ error: message }, 400);
    }
  });
