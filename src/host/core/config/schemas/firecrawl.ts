import { z } from "zod";

export const firecrawlSchema = z.object({
  api_url: z.string().optional(),
});
