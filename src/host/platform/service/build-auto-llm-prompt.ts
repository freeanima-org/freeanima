import { buildMemorySystemPromptSections } from "@freeanima/host/capabilities/memory/system-prompt-sections";

/** Memory citation/recall + optional agents/task for AutoLlmRun（工作模式，无 self/resident） */
export async function buildAutoLlmSystemPrompt(opts?: {
  cwd?: string | null;
  taskSection?: string;
}): Promise<string> {
  const sections = await buildMemorySystemPromptSections("", opts?.cwd ?? null, "work");
  const chunks = [...sections].toSorted((a, b) => a.order - b.order).map((s) => s.content.trim());
  if (opts?.taskSection?.trim()) chunks.push(opts.taskSection.trim());
  return chunks.filter(Boolean).join("\n\n");
}

export function formatCronAutoLlmTaskSection(runName: string): string {
  return `## 自动化任务\n当前任务：${runName}（Cron）`;
}
