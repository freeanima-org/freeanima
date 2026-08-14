import { z } from "zod";

/** Discord 网关段；passthrough 保留未接线旧字段 */
export const discordConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    token: z.string().optional(),
    require_mention: z.boolean().optional(),
    free_response_channels: z.string().optional(),
    allowed_channels: z.string().optional(),
    auto_thread: z.boolean().optional(),
    thread_require_mention: z.boolean().optional(),
    slash_commands: z.boolean().optional(),
    slash_commands_guild_id: z.string().optional(),
    session_handoff_on_new: z.boolean().optional(),
    home_channel: z.string().optional(),
    home_thread_id: z.string().optional(),
  })
  .passthrough()
  .optional();

export type DiscordConfigInput = z.infer<typeof discordConfigSchema>;
