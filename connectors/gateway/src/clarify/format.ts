import type { ClarifyItem } from "@freeanima/core/db/domain";

import type { ClarifyPayload } from "./types.ts";

export function formatClarifyPlain(items: ClarifyItem[]): string {
  const parts: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    parts.push(`❓ ${i + 1}. ${item.question}`);
    if (item.choices?.length) {
      for (let j = 0; j < item.choices.length; j++) {
        parts.push(`   ${j + 1}. ${item.choices[j]}`);
      }
    }
  }
  return parts.join("\n");
}

export function formatClarifyDiscord(payload: ClarifyPayload): string {
  const lines = ["**Confirmation needed:**", ""];
  for (let i = 0; i < payload.items.length; i++) {
    const item = payload.items[i]!;
    lines.push(`**${i + 1}. ${item.question}**`);
    if (item.choices?.length) {
      for (let j = 0; j < item.choices.length; j++) {
        lines.push(`   ${j + 1}. ${item.choices[j]}`);
      }
    }
    lines.push("");
  }
  lines.push(
    `Reply within ${Math.round(payload.timeout_sec / 60)} minute(s), or send /cancel to abort.`,
  );
  return lines.join("\n").trim();
}

export function formatClarifyWeixin(payload: ClarifyPayload): string {
  const lines = ["[Pending confirmation]"];
  for (let i = 0; i < payload.items.length; i++) {
    const item = payload.items[i]!;
    lines.push(`${i + 1}. ${item.question}`);
    if (item.choices?.length) {
      lines.push(`   Options: ${item.choices.map((c, idx) => `${idx + 1}.${c}`).join(" ")}`);
    }
  }
  lines.push("Reply to all questions in one message, or send /cancel to abort.");
  return lines.join("\n");
}

export function formatClarifyWebUi(payload: ClarifyPayload): string {
  return formatClarifyPlain(payload.items);
}
