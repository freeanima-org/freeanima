/** 通用 Habitat RPC request 默认超时（快速反馈） */
export const HABITAT_RPC_DEFAULT_REQUEST_TIMEOUT_MS = 3_000;

/** message.send 首包 ack（stream_id）超时 */
export const HABITAT_RPC_MESSAGE_SEND_TIMEOUT_MS = 10_000;

/** email.sync / 多箱 IMAP 同步（含 FLAGS 刷新） */
export const HABITAT_RPC_EMAIL_SYNC_TIMEOUT_MS = 120_000;

/** email 写路径涉及 IMAP 的操作（mailbox CRUD / move / append 等） */
export const HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS = 60_000;

/** 对象文件 / companion 二进制上传下载（VRM、VRMA 等） */
export const HABITAT_RPC_BINARY_TRANSFER_TIMEOUT_MS = 600_000;

/** WS 无任何 inbound 超过此时间则主动断连重连 */
export const HABITAT_RPC_LIVENESS_SILENCE_MS = 10_000;

/** rpc.connect 握手超时 */
export const HABITAT_RPC_CONNECT_TIMEOUT_MS = 10_000;

/** 客户端 liveness 检查间隔 */
export const HABITAT_RPC_LIVENESS_CHECK_INTERVAL_MS = 5_000;

/** 客户端心跳发送间隔上限（与服务端 interval 取 min） */
export const HABITAT_RPC_HEARTBEAT_SEND_CAP_MS = 5_000;
