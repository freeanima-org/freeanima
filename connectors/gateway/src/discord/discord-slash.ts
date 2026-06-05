import { logComponent } from "@freeanima/service-logging";
import type { NestService } from "@freeanima/legacy-runtime";
import {
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";

import { deliverDiscordFinalContent, withDiscordRetry } from "./discord-retry.ts";
import type { DiscordConfig } from "./discord-policy.ts";
import { extractOrigin, type PlatformOrigin } from "./discord-policy.ts";

export type DiscordSlashCommandMeta = {
  name: string;
  description: string;
};

const OPTION_APPLIERS: Record<string, (builder: SlashCommandBuilder) => void> = {
  cwd: (b) => {
    b.addStringOption((o) =>
      o.setName("path").setDescription("工作目录路径（留空则查看当前）").setRequired(false),
    );
  },
  title: (b) => {
    b.addStringOption((o) =>
      o.setName("title").setDescription("新标题，最多 50 字（留空则查看当前）").setRequired(false),
    );
  },
  stats: (b) => {
    b.addBooleanOption((o) =>
      o.setName("all").setDescription("汇总全部 session 的统计").setRequired(false),
    );
  },
};

/** 由 NestService 命令列表生成 Discord Application Commands 定义 */
export function buildDiscordSlashCommands(
  commands: DiscordSlashCommandMeta[],
): ReturnType<SlashCommandBuilder["toJSON"]>[] {
  return commands.map((cmd) => {
    const builder = new SlashCommandBuilder()
      .setName(cmd.name)
      .setDescription(cmd.description.slice(0, 100));
    OPTION_APPLIERS[cmd.name]?.(builder);
    return builder.toJSON();
  });
}

/** Discord 交互 → 逸灵风 slash 文本（如 `/cwd path:/tmp` → `/cwd /tmp`） */
export function interactionToCommandText(interaction: ChatInputCommandInteraction): string {
  const name = interaction.commandName;
  const parts: string[] = [];

  const path = interaction.options.getString("path");
  const title = interaction.options.getString("title");
  const all = interaction.options.getBoolean("all");

  if (path) parts.push(path);
  if (title) parts.push(title);
  if (all) parts.push("--all");

  return parts.length ? `/${name} ${parts.join(" ")}` : `/${name}`;
}

export function originFromInteraction(interaction: ChatInputCommandInteraction): PlatformOrigin {
  const channel = interaction.channel;
  if (!channel) {
    throw new Error("interaction has no channel");
  }
  const isThread = "isThread" in channel && channel.isThread();
  const channelId = channel.id;
  const parentChannelId =
    isThread && "parentId" in channel && channel.parentId ? String(channel.parentId) : channelId;
  return extractOrigin({
    channelId,
    parentChannelId,
    guildId: interaction.guildId ?? "",
    isThread,
  });
}

export async function syncDiscordSlashCommands(
  client: Client,
  token: string,
  service: NestService,
  cfg: DiscordConfig,
): Promise<void> {
  if (cfg.slash_commands === false) return;

  const appId = client.user?.id;
  if (!appId) return;

  const { commands } = service.listCommands({ platform: "discord" });
  const body = buildDiscordSlashCommands(commands);
  const rest = new REST({ version: "10" }).setToken(token);
  const guildId = String(cfg.slash_commands_guild_id ?? "").trim();

  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
      logComponent("discord").info(
        `Discord slash commands synced to guild ${guildId} (${body.length} commands)`,
        { guild_id: guildId, command_count: body.length },
      );
    } else {
      await rest.put(Routes.applicationCommands(appId), { body });
      logComponent("discord").info(
        `Discord slash commands synced globally (${body.length} commands)`,
        { command_count: body.length },
      );
    }
  } catch (e) {
    logComponent("discord").error("Discord slash command sync failed", { err: e });
  }
}

export async function replyDiscordInteraction(
  interaction: ChatInputCommandInteraction,
  text: string,
  splitMessage: (t: string) => string[],
): Promise<void> {
  const chunks = splitMessage(text);
  if (!chunks.length) {
    await withDiscordRetry(() => interaction.editReply({ content: "（无输出）" }));
    return;
  }
  await deliverDiscordFinalContent(
    async () => {
      await interaction.editReply({ content: chunks[0]! });
    },
    async () => {
      await interaction.followUp({ content: chunks[0]! });
    },
    { kind: "slash", chunk: 0 },
  );
  for (const chunk of chunks.slice(1)) {
    await withDiscordRetry(() => interaction.followUp({ content: chunk }));
  }
}
