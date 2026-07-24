import { loadSelfLayerPrompt } from "@freeanima/host/capabilities/self";
import { buildMemorySystemPromptSections } from "@freeanima/host/capabilities/memory/system-prompt-sections";

/** Self-layer + resident + optional task section for AutoLlmRun system prompt */
export async function buildAutoLlmSystemPrompt(opts?: {
  selfContent?: string;
  cwd?: string | null;
  taskSection?: string;
}): Promise<string> {
  const selfContent = opts?.selfContent ?? (await loadSelfLayerPrompt());
  const sections = await buildMemorySystemPromptSections(selfContent, opts?.cwd ?? null);
  const chunks = [...sections].toSorted((a, b) => a.order - b.order).map((s) => s.content.trim());
  if (opts?.taskSection?.trim()) chunks.push(opts.taskSection.trim());
  return chunks.filter(Boolean).join("\n\n");
}

export function formatCronAutoLlmTaskSection(runName: string): string {
  return `## 自动化任务\n当前任务：${runName}（Cron）`;
}
