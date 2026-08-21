import type { ClarifyItem } from "@freeanima/habitat/core/db/domain";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type APIActionRowComponent,
  type APIButtonComponent,
  type APIMessageComponent,
  type Message,
} from "discord.js";

import type { ClarifyPayload } from "../clarify/types.ts";
import { formatClarifyDiscordWithButtons } from "../clarify/format.ts";

const CUSTOM_ID_PREFIX = "clarify:";
const DISCORD_BUTTON_LABEL_MAX = 80;
const CANCEL_LABEL = "取消";

export type ClarifyButtonCustomId =
  | { conversationId: string; kind: "choice"; choiceIndex: number }
  | { conversationId: string; kind: "cancel" };

export function canRenderClarifyButtons(payload: ClarifyPayload): boolean {
  return payload.items.length === 1 && (payload.items[0]?.choices?.length ?? 0) > 0;
}

export function formatClarifyDiscordContentForButtons(payload: ClarifyPayload): string {
  return formatClarifyDiscordWithButtons(payload);
}

function truncateButtonLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= DISCORD_BUTTON_LABEL_MAX) return trimmed;
  return `${trimmed.slice(0, DISCORD_BUTTON_LABEL_MAX - 1)}…`;
}

export function choiceButtonCustomId(conversationId: string, choiceIndex: number): string {
  return `${CUSTOM_ID_PREFIX}${conversationId}:0:${choiceIndex}`;
}

export function cancelButtonCustomId(conversationId: string): string {
  return `${CUSTOM_ID_PREFIX}${conversationId}:cancel`;
}

export function parseClarifyButtonCustomId(customId: string): ClarifyButtonCustomId | null {
  if (!customId.startsWith(CUSTOM_ID_PREFIX)) return null;
  const parts = customId.slice(CUSTOM_ID_PREFIX.length).split(":");
  if (parts.length < 2) return null;
  const conversationId = parts[0];
  if (conversationId === undefined) return null;
  if (parts[1] === "cancel") {
    return { conversationId, kind: "cancel" };
  }
  if (parts[1] === "0" && parts.length === 3) {
    const choiceIndex = Number(parts[2]);
    if (!Number.isInteger(choiceIndex) || choiceIndex < 0) return null;
    return { conversationId, kind: "choice", choiceIndex };
  }
  return null;
}

export function buildClarifyActionRows(
  conversationId: string,
  item: ClarifyItem,
): ActionRowBuilder<ButtonBuilder>[] {
  const choices = item.choices ?? [];
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (let i = 0; i < choices.length; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(choiceButtonCustomId(conversationId, i))
        .setLabel(truncateButtonLabel(choices[i] ?? ""))
        .setStyle(ButtonStyle.Primary),
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(cancelButtonCustomId(conversationId))
      .setLabel(CANCEL_LABEL)
      .setStyle(ButtonStyle.Danger),
  );
  return [row];
}

function isButtonComponent(component: APIMessageComponent): component is APIButtonComponent {
  return component.type === ComponentType.Button;
}

export function disabledActionRowsFromMessage(message: Message): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (const row of message.components) {
    if (row.type !== ComponentType.ActionRow) continue;
    // discord.js MessageComponent → ActionRow 运行时边界
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- discord.js ActionRow 组件边界
    const actionRow = row as APIActionRowComponent<APIButtonComponent>;
    const builder = new ActionRowBuilder<ButtonBuilder>();
    for (const component of actionRow.components) {
      if (!isButtonComponent(component)) continue;
      builder.addComponents(ButtonBuilder.from(component).setDisabled(true));
    }
    if (builder.components.length > 0) {
      rows.push(builder);
    }
  }
  return rows;
}
