import type { DreamEpisodicSnippet } from "@freeanima/habitat/core/db/schema";
import type { LimbicMemoryRow } from "@freeanima/habitat/core/db/schema/rows";

import type { DreamGatherInput } from "./gather-input.ts";

function formatLimbicBlock(rows: LimbicMemoryRow[]): string {
  if (rows.length === 0) return "(无情感素材)";
  return rows
    .map((row, i) => {
      const parts = [`## 情感 ${i + 1} (intensity=${row.intensity})`, row.content.trim()];
      if (row.valence != null) parts.push(`valence=${row.valence}`);
      if (row.arousal != null) parts.push(`arousal=${row.arousal}`);
      return parts.join("\n");
    })
    .join("\n\n");
}

function formatEpisodicBlock(snippets: DreamEpisodicSnippet[]): string {
  if (snippets.length === 0) return "(无情景片段)";
  return snippets
    .map((s, i) => {
      const ts = s.timestamp?.slice(0, 19) ?? "?";
      return `## 片段 ${i + 1} (${ts}, ${s.role}, session=${s.conversation_id})\n${s.content.trim()}`;
    })
    .join("\n\n");
}

export function buildDreamSystemPrompt(selfContent: string): string {
  return `${selfContent.trim()}

---

你正在进入做梦状态。这不是事实整理，而是夜间潜意识里的自由联想。

要求：
- 用第一人称写一段梦境叙事（300–800 字）
- 以给定情感记忆为主色调，可变形、可隐喻、可跳跃
- 可随机吸收情景片段中的意象，但不要逐句复述对话
- 允许 surreal、非线性、象征性场景
- 不要写成分析报告；不要强调「这是梦」的元叙述
- 输出纯正文，不要标题或 markdown`;
}

export function buildDreamUserMessage(input: DreamGatherInput): string {
  return `# 做梦素材 (${input.day})

## 情感主色调（当天产生，含浅睡写入；强度 > 0.5，取前 ${input.limbicMemories.length} 条）

${formatLimbicBlock(input.limbicMemories)}

## 随机情景片段（仅供发散）

${formatEpisodicBlock(input.episodicSnippets)}

请根据以上素材，写一段属于你自己的梦。`;
}

export type DreamEngineInput = {
  systemPrompt: string;
  userMessage: string;
};

export function buildDreamEngineInput(
  selfContent: string,
  input: DreamGatherInput,
): DreamEngineInput {
  return {
    systemPrompt: buildDreamSystemPrompt(selfContent),
    userMessage: buildDreamUserMessage(input),
  };
}
