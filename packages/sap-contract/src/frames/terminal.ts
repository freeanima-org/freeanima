import { z } from "zod";

export const terminalAttachInputSchema = z.object({
  cwd: z.string().optional(),
});

export type TerminalAttachInput = z.infer<typeof terminalAttachInputSchema>;

export const terminalAttachOutputSchema = z.object({
  terminal_id: z.string(),
});

export type TerminalAttachOutput = z.infer<typeof terminalAttachOutputSchema>;

export const terminalWriteInputSchema = z.object({
  terminal_id: z.string().min(1),
  data: z.string(),
});

export type TerminalWriteInput = z.infer<typeof terminalWriteInputSchema>;

export const terminalResizeInputSchema = z.object({
  terminal_id: z.string().min(1),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export type TerminalResizeInput = z.infer<typeof terminalResizeInputSchema>;

export const terminalCloseInputSchema = z.object({
  terminal_id: z.string().min(1),
});

export type TerminalCloseInput = z.infer<typeof terminalCloseInputSchema>;

export const TERMINAL_EVENT_METHODS = [
  "terminal.ready",
  "terminal.output",
  "terminal.exit",
  "terminal.error",
] as const;

export type TerminalEventMethod = (typeof TERMINAL_EVENT_METHODS)[number];
