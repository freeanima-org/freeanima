import { readFileSync } from "node:fs";
import { parseJsonLine } from "@freeanima/kernel-util";
import type { z } from "zod";

/** 读取 JSONL 文件，跳过无效行 */
export function readJsonlFile<T extends z.ZodType>(path: string, schema: T): z.infer<T>[] {
  const records: z.infer<T>[] = [];
  try {
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      const parsed = parseJsonLine(line, schema);
      if (parsed) records.push(parsed);
    }
  } catch {
    /* 文件不存在或不可读 */
  }
  return records;
}

/** 解析内存中的 JSONL 文本，跳过无效行 */
export function readJsonlText<T extends z.ZodType>(text: string, schema: T): z.infer<T>[] {
  const records: z.infer<T>[] = [];
  for (const line of text.split("\n")) {
    const parsed = parseJsonLine(line, schema);
    if (parsed) records.push(parsed);
  }
  return records;
}
