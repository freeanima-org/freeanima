import { z } from "zod";

export const sessionAcpDockInputSchema = z.object({
  session_id: z.string().min(1),
});

export type SessionAcpDockInput = z.infer<typeof sessionAcpDockInputSchema>;

export const acpDockTaskSchema = z.object({
  acp_session_id: z.string(),
  task_id: z.string(),
  agent_name: z.string(),
  status: z.string(),
  progress_message_id: z.string().optional(),
});

export type AcpDockTask = z.infer<typeof acpDockTaskSchema>;

export const sessionAcpDockOutputSchema = z.object({
  session_id: z.string(),
  tasks: z.array(acpDockTaskSchema),
  progress_text: z.string(),
  task_progress: z.record(z.string(), z.string()),
  highlight_decision: z.boolean(),
});

export type SessionAcpDockOutput = z.infer<typeof sessionAcpDockOutputSchema>;
