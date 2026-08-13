import { z } from "zod";

export const clarifyItemSchema = z.object({
  question: z.string().min(1),
  choices: z.array(z.string().min(1)).max(4).optional(),
  default: z.string().optional(),
});

export type ClarifyItem = z.infer<typeof clarifyItemSchema>;
