/**
 * Habitat RPC 客户端请求超时三档（ms）。
 * method meta.timeoutMs / call opts 可覆盖；特殊通道（邮件 IMAP、二进制大文件等）单独常量。
 */
/** 读操作默认（list / get / search / status…） */
export const HABITAT_RPC_READ_TIMEOUT_MS = 3_000;
/** 写操作默认（create / patch / delete…） */
export const HABITAT_RPC_WRITE_TIMEOUT_MS = 10_000;
/** 导入、rebuild、LLM 探活与其它长任务 */
export const HABITAT_RPC_LONG_TIMEOUT_MS = 30_000;
