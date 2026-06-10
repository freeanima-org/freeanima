import { z } from "zod";

import { toolErrorSchema } from "../tool-json.ts";

/** 全局工具失败返回契约 */
export const toolErrorReturnSchema = toolErrorSchema;

export const toolErrorReturnExample = { error: "示例错误信息" } as const;

/** text 工具成功返回的 JSON Schema 视图 */
export const textReturnJsonSchema = {
  type: "string",
  description: "LLM 可读纯文本",
} as const;

/** 常见 ok 包装 */
export const okObjectSchema = z.object({ ok: z.literal(true) });

/** 行号前缀文本示例（file_read_file 等） */
export const textLineNumberExample = "1|第一行内容\n2|第二行内容";

export function paginatedListSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number(),
  });
}
