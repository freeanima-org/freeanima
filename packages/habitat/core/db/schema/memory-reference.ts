/**
 * #16102：memory_references 边表已删除。
 * 引用热度只留 entities.reference_count；cite 见 MemoryService.syncTurn。
 * 本文件保留模块以免旧 import 路径断裂；勿再导出 pgTable。
 */

export const MEMORY_REFERENCES_TABLE_DROPPED = true as const;
