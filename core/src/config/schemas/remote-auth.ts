import { z } from "zod";

export const remoteAuthConfigSchema = z.object({
  token: z.string().min(16),
});

export type RemoteAuthConfig = z.infer<typeof remoteAuthConfigSchema>;
