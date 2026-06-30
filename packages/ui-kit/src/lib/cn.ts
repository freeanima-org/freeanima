/** 合并 className 片段（复合组件内部使用） */
export function cn(...parts: Array<string | undefined | false | null>): string {
  return parts.filter(Boolean).join(" ");
}
