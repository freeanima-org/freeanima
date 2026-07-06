/** 通用 Hub RPC request 默认超时（快速反馈） */
export const HUB_RPC_DEFAULT_REQUEST_TIMEOUT_MS = 3_000;

/** message.send 首包 ack（stream_id）超时 */
export const HUB_RPC_MESSAGE_SEND_TIMEOUT_MS = 10_000;

/** WS 无任何 inbound 超过此时间则主动断连重连 */
export const HUB_RPC_LIVENESS_SILENCE_MS = 10_000;

/** rpc.connect 握手超时 */
export const HUB_RPC_CONNECT_TIMEOUT_MS = 10_000;

/** 客户端 liveness 检查间隔 */
export const HUB_RPC_LIVENESS_CHECK_INTERVAL_MS = 5_000;

/** 客户端心跳发送间隔上限（与服务端 interval 取 min） */
export const HUB_RPC_HEARTBEAT_SEND_CAP_MS = 5_000;
