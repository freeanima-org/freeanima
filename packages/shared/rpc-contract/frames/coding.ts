import { z } from "zod";

export const codingNoteCreateInputSchema = z.object({
  /** 项目 Public World id（conversation.project_world_id） */
  world_id: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(2000).optional(),
  content: z.string().max(200_000).optional(),
  /** coding_note.body.kind，如 explore / decision */
  kind: z.string().trim().min(1).max(64).optional(),
});
export type CodingNoteCreateInput = z.infer<typeof codingNoteCreateInputSchema>;

export const codingNoteRowSchema = z.object({
  id: z.number().int().positive(),
  world_id: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  kind: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CodingNoteRowPayload = z.infer<typeof codingNoteRowSchema>;

export const codingNoteCreateOutputSchema = z.object({
  item: codingNoteRowSchema,
});
export type CodingNoteCreateOutput = z.infer<typeof codingNoteCreateOutputSchema>;

export const codingNoteListInputSchema = z.object({
  world_id: z.number().int().positive(),
  limit: z.number().int().positive().max(200).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type CodingNoteListInput = z.infer<typeof codingNoteListInputSchema>;

export const codingNoteListOutputSchema = z.object({
  items: z.array(codingNoteRowSchema),
  count: z.number().int().nonnegative(),
});
export type CodingNoteListOutput = z.infer<typeof codingNoteListOutputSchema>;

/** 项目 Agent 上下文 snapshot（Outpost 发现 → Habitat 会话缓存） */
export const projectAgentContextSnapshotSchema = z
  .object({
    rules: z.array(z.record(z.string(), z.unknown())),
    skills: z.array(z.record(z.string(), z.unknown())),
    agents: z.array(z.record(z.string(), z.unknown())),
    mcpServers: z.array(z.record(z.string(), z.unknown())),
    agentsMdPath: z.string().nullable(),
    sources: z.array(z.string()),
    discovered_at: z.string(),
    workspace_root: z.string(),
  })
  .passthrough();

export const codingProjectContextSyncInputSchema = z.object({
  conversation_id: z.string().min(1),
  snapshot: projectAgentContextSnapshotSchema,
});
export type CodingProjectContextSyncInput = z.infer<typeof codingProjectContextSyncInputSchema>;

export const codingProjectContextSyncOutputSchema = z.object({
  ok: z.literal(true),
  conversation_id: z.string(),
});
export type CodingProjectContextSyncOutput = z.infer<typeof codingProjectContextSyncOutputSchema>;

/** UI 只读：经 Habitat 同步调用远端 coding outpost 工具（不做 client 中继） */
export const CODING_OUTPOST_EXEC_TOOLS = [
  "file_list",
  "file_read",
  "file_search",
  "project_context",
] as const;
export type CodingOutpostExecTool = (typeof CODING_OUTPOST_EXEC_TOOLS)[number];

export const codingOutpostExecInputSchema = z.object({
  instance_id: z.string().min(1),
  tool: z.enum(CODING_OUTPOST_EXEC_TOOLS),
  args: z.record(z.string(), z.unknown()).default({}),
  workspace_root: z.string().min(1).optional(),
  /** 可选：写入 tool.call payload，便于 probe 侧日志关联 */
  conversation_id: z.string().min(1).optional(),
});
export type CodingOutpostExecInput = z.infer<typeof codingOutpostExecInputSchema>;

export const codingOutpostExecOutputSchema = z.object({
  ok: z.literal(true),
  content: z.string(),
});
export type CodingOutpostExecOutput = z.infer<typeof codingOutpostExecOutputSchema>;
