import { emailAccountSchema, type EmailAccountConfig } from "@freeanima/service-config";
import { z } from "zod";

export type EmailAccount = EmailAccountConfig;

export const emailAccountInputSchema = emailAccountSchema;
export type EmailAccountInput = z.input<typeof emailAccountInputSchema>;

export const emailAccountPatchSchema = emailAccountSchema.omit({ id: true }).partial();
export type EmailAccountPatch = z.infer<typeof emailAccountPatchSchema>;

export type EmailMessage = {
  uid: number;
  account_id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  preview: string;
  unread: boolean;
  body?: string;
};

export const emailFilterSchema = z.object({
  unread: z.boolean().optional(),
  since: z.string().optional(),
  from: z.string().optional(),
  subject: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

export type EmailFilter = z.infer<typeof emailFilterSchema>;

export type EmailAccountView = EmailAccount;
