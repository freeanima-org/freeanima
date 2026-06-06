import { z } from "zod";

import {
  awaitingClarifySchema,
  compressionJsonSchema,
  sessionTodoStoreSchema,
  todoItemSchema,
  todoStatusSchema,
  clarifyItemSchema,
} from "../schema/index.ts";
import { safeParseOrNull } from "@freeanima/kernel-util";

export {
  awaitingClarifySchema,
  sessionTodoStoreSchema,
  todoItemSchema,
  todoStatusSchema,
  clarifyItemSchema,
};

export type TodoStatus = z.infer<typeof todoStatusSchema>;
export type TodoItem = z.infer<typeof todoItemSchema>;
export type SessionTodoStore = z.infer<typeof sessionTodoStoreSchema>;
export type ClarifyItem = z.infer<typeof clarifyItemSchema>;
export type AwaitingClarify = z.infer<typeof awaitingClarifySchema>;

export const clarifyToolAwaitingResultSchema = z.object({
  status: z.literal("awaiting"),
  items: z.array(clarifyItemSchema).min(1),
  timeout_sec: z.number().min(60),
});

export const clarifyToolResolvedResultSchema = z.object({
  status: z.literal("resolved"),
  answers: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    }),
  ),
});

export const clarifyToolResultSchema = z.union([
  clarifyToolAwaitingResultSchema,
  clarifyToolResolvedResultSchema,
  z.object({ error: z.string().min(1) }),
]);

export type ClarifyToolAwaitingResult = z.infer<typeof clarifyToolAwaitingResultSchema>;
export type ClarifyToolResolvedResult = z.infer<typeof clarifyToolResolvedResultSchema>;

function attachSummaryFields(
  o: Record<string, unknown>,
  base: { l2: number; l3: number },
): { l2: number; l3: number; summary?: string; summary_at?: string } {
  const state: { l2: number; l3: number; summary?: string; summary_at?: string } = { ...base };
  if (typeof o.summary === "string" && o.summary.trim()) state.summary = o.summary.trim();
  if (typeof o.summary_at === "string") state.summary_at = o.summary_at;
  return state;
}

/** anchor_id→l3；cut_id / last_summarized_cut_id→l2 */
function migrateLegacyCompression(o: Record<string, unknown>): {
  l2: number;
  l3: number;
  summary?: string;
  summary_at?: string;
} | null {
  const anchor = o.anchor_id ?? o.cut_id;
  const cut = o.cut_id;
  const lastSum = o.last_summarized_cut_id;

  if (anchor === undefined && cut === undefined && lastSum === undefined) return null;

  let l3 = 0;
  let l2 = 0;

  if (o.anchor_id !== undefined) {
    const a = Number(o.anchor_id);
    if (!Number.isNaN(a)) l3 = a;
  } else if (cut !== undefined) {
    const c = Number(cut);
    if (!Number.isNaN(c)) l3 = c;
  }

  if (lastSum !== undefined) {
    const ls = Number(lastSum);
    if (!Number.isNaN(ls)) l2 = ls;
  } else if (cut !== undefined && o.anchor_id === undefined) {
    l2 = 0;
  }

  if (l3 === 0 && l2 === 0 && cut === undefined) return null;
  return attachSummaryFields(o, { l2, l3 });
}

/** 领域层压缩状态：存储形状见 kernel-db compressionJsonSchema；legacy 仅读路径 */
export const compressionStateSchema = z
  .unknown()
  .transform((raw, ctx): z.infer<typeof compressionJsonSchema> | null => {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;

    const direct = compressionJsonSchema.safeParse(raw);
    if (direct.success) return direct.data;

    const migrated = migrateLegacyCompression(o);
    if (!migrated) {
      ctx.addIssue({ code: "custom", message: "invalid compression state" });
      return z.NEVER;
    }
    return migrated;
  })
  .nullable()
  .catch(null);

export type CompressionState = z.infer<typeof compressionJsonSchema>;

export function parseCompressionState(raw: unknown): CompressionState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const direct = compressionJsonSchema.safeParse(raw);
  if (direct.success) return direct.data;

  return migrateLegacyCompression(o);
}

export function parseSessionTodoStore(raw: unknown): SessionTodoStore {
  const result = sessionTodoStoreSchema.safeParse(raw);
  if (result.success) return result.data;
  return { items: [], next_id: 1 };
}

export function parseAwaitingClarify(raw: unknown): AwaitingClarify | null {
  return safeParseOrNull(awaitingClarifySchema, raw);
}
