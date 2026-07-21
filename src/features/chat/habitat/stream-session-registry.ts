import type { SapDisplayItem } from "@freeanima/shared/sap-contract/frames/message";

/** 生成完成后保留快照，供短时 attach 重放 */
export const STREAM_SESSION_DONE_TTL_MS = 600_000;

export type StreamSessionStatus = "active" | "done" | "error" | "interrupted";

export type StreamSessionEmitter = (method: string, payload: Record<string, unknown>) => void;

export type StreamSessionSnapshot = {
  stream_id: string;
  conversation_id: string;
  status: StreamSessionStatus;
  answer_text: string;
  display_items: SapDisplayItem[];
  client_op_id?: string;
  terminal_reason?: string;
  terminal_error?: string;
  updated_at: number;
};

type StreamSession = StreamSessionSnapshot & {
  subscribers: Set<StreamSessionEmitter>;
  expireTimer: ReturnType<typeof setTimeout> | null;
};

function isDisplayItem(value: unknown): value is SapDisplayItem {
  if (!value || typeof value !== "object") return false;
  const item = value as { type?: unknown };
  return item.type === "message" || item.type === "tool_block";
}

export class StreamSessionRegistry {
  private readonly byStreamId = new Map<string, StreamSession>();
  private readonly byClientOpId = new Map<string, string>();
  /** 每个 conversation 最近一条流（刷新后按会话查找） */
  private readonly byConversationId = new Map<string, string>();

  openSession(
    streamId: string,
    conversationId: string,
    opts?: { client_op_id?: string },
  ): StreamSessionSnapshot {
    this.clearExpireTimer(streamId);
    const session: StreamSession = {
      stream_id: streamId,
      conversation_id: conversationId,
      status: "active",
      answer_text: "",
      display_items: [],
      updated_at: Date.now(),
      subscribers: new Set(),
      expireTimer: null,
      ...(opts?.client_op_id ? { client_op_id: opts.client_op_id } : {}),
    };
    this.byStreamId.set(streamId, session);
    this.byConversationId.set(conversationId, streamId);
    if (opts?.client_op_id) {
      this.byClientOpId.set(opts.client_op_id, streamId);
    }
    return this.toSnapshot(session);
  }

  getSession(streamId: string): StreamSessionSnapshot | null {
    const session = this.byStreamId.get(streamId);
    return session ? this.toSnapshot(session) : null;
  }

  findByClientOpId(clientOpId: string): StreamSessionSnapshot | null {
    const streamId = this.byClientOpId.get(clientOpId);
    if (!streamId) return null;
    return this.getSession(streamId);
  }

  findByConversationId(conversationId: string): StreamSessionSnapshot | null {
    const streamId = this.byConversationId.get(conversationId);
    if (!streamId) return null;
    return this.getSession(streamId);
  }

  /** 订阅 fan-out；返回取消订阅函数 */
  subscribe(streamId: string, emit: StreamSessionEmitter): (() => void) | null {
    const session = this.byStreamId.get(streamId);
    if (!session) return null;
    session.subscribers.add(emit);
    return () => {
      session.subscribers.delete(emit);
    };
  }

  /**
   * attach/续传独占 fan-out：清掉发起连接等旧订阅后再挂新 emit。
   * 否则同 WS 上 message.send 泵订阅 + stream.attach 并存，token 双发 → 客户端字词重复。
   */
  subscribeExclusive(streamId: string, emit: StreamSessionEmitter): (() => void) | null {
    const session = this.byStreamId.get(streamId);
    if (!session) return null;
    session.subscribers.clear();
    session.subscribers.add(emit);
    return () => {
      session.subscribers.delete(emit);
    };
  }

  /**
   * 更新 buffer 并广播。返回 false 表示 session 不存在。
   * llm_debug 不入 buffer，也不广播（由 pump 单独处理）。
   */
  applyAndPublish(method: string, payload: Record<string, unknown>): boolean {
    const streamId = typeof payload.stream_id === "string" ? payload.stream_id : "";
    if (!streamId) return false;
    const session = this.byStreamId.get(streamId);
    if (!session) return false;

    this.applyBuffer(session, method, payload);
    session.updated_at = Date.now();
    this.publish(session, method, payload);

    if (method === "stream.done" || method === "stream.error" || method === "stream.interrupted") {
      this.markTerminal(session, method, payload);
    }
    return true;
  }

  /** 将当前文本 buffer 以 content_replace 推给指定 emit；终态再补 terminal 事件 */
  replaySnapshot(streamId: string, emit: StreamSessionEmitter): boolean {
    const session = this.byStreamId.get(streamId);
    if (!session) return false;

    emit("stream.accepted", { stream_id: streamId });

    // 方案二 buffer dump：只推文本快照，避免 display_append 在客户端重复
    emit("stream.content_replace", {
      stream_id: streamId,
      content: session.answer_text,
    });

    if (session.status === "error") {
      emit("stream.error", {
        stream_id: streamId,
        error: session.terminal_error ?? "error",
      });
      emit("stream.done", { stream_id: streamId });
    } else if (session.status === "interrupted") {
      emit("stream.interrupted", {
        stream_id: streamId,
        reason: session.terminal_reason ?? "interrupted",
      });
      emit("stream.done", {
        stream_id: streamId,
        reason: "interrupted",
      });
    } else if (session.status === "done") {
      emit("stream.done", {
        stream_id: streamId,
        ...(session.terminal_reason ? { reason: session.terminal_reason } : {}),
      });
    }

    return true;
  }

  /** 测试 / 关停：立即移除 */
  deleteSession(streamId: string): void {
    const session = this.byStreamId.get(streamId);
    if (!session) return;
    this.clearExpireTimer(streamId);
    if (session.client_op_id) {
      const mapped = this.byClientOpId.get(session.client_op_id);
      if (mapped === streamId) this.byClientOpId.delete(session.client_op_id);
    }
    const mappedConv = this.byConversationId.get(session.conversation_id);
    if (mappedConv === streamId) this.byConversationId.delete(session.conversation_id);
    this.byStreamId.delete(streamId);
  }

  /** 测试用：清空全部 */
  resetForTests(): void {
    for (const streamId of Array.from(this.byStreamId.keys())) {
      this.deleteSession(streamId);
    }
  }

  private applyBuffer(
    session: StreamSession,
    method: string,
    payload: Record<string, unknown>,
  ): void {
    switch (method) {
      case "stream.token": {
        const content = typeof payload.content === "string" ? payload.content : "";
        session.answer_text += content;
        break;
      }
      case "stream.content_replace": {
        session.answer_text = typeof payload.content === "string" ? payload.content : "";
        break;
      }
      case "stream.display_append": {
        if (isDisplayItem(payload.item)) {
          session.display_items.push(payload.item);
          if (payload.item.type === "message" && payload.item.role === "assistant") {
            // display_append 提交 assistant 段后，前端会清空 streamText；buffer 同步清空
            session.answer_text = "";
          }
        }
        break;
      }
      default:
        break;
    }
  }

  private markTerminal(
    session: StreamSession,
    method: string,
    payload: Record<string, unknown>,
  ): void {
    if (session.status !== "active") {
      this.scheduleExpire(session);
      return;
    }
    if (method === "stream.error") {
      session.status = "error";
      session.terminal_error = typeof payload.error === "string" ? payload.error : "error";
    } else if (method === "stream.interrupted") {
      session.status = "interrupted";
      session.terminal_reason = typeof payload.reason === "string" ? payload.reason : "interrupted";
    } else {
      session.status = "done";
      if (typeof payload.reason === "string") {
        session.terminal_reason = payload.reason;
      }
    }
    this.scheduleExpire(session);
  }

  private scheduleExpire(session: StreamSession): void {
    this.clearExpireTimer(session.stream_id);
    session.expireTimer = setTimeout(() => {
      this.deleteSession(session.stream_id);
    }, STREAM_SESSION_DONE_TTL_MS);
    // 允许进程退出时不挂起
    session.expireTimer.unref?.();
  }

  private clearExpireTimer(streamId: string): void {
    const session = this.byStreamId.get(streamId);
    if (!session?.expireTimer) return;
    clearTimeout(session.expireTimer);
    session.expireTimer = null;
  }

  private publish(session: StreamSession, method: string, payload: Record<string, unknown>): void {
    for (const emit of session.subscribers) {
      try {
        emit(method, payload);
      } catch {
        /* 订阅方异常不影响其他订阅者 */
      }
    }
  }

  private toSnapshot(session: StreamSession): StreamSessionSnapshot {
    return {
      stream_id: session.stream_id,
      conversation_id: session.conversation_id,
      status: session.status,
      answer_text: session.answer_text,
      display_items: [...session.display_items],
      updated_at: session.updated_at,
      ...(session.client_op_id ? { client_op_id: session.client_op_id } : {}),
      ...(session.terminal_reason ? { terminal_reason: session.terminal_reason } : {}),
      ...(session.terminal_error ? { terminal_error: session.terminal_error } : {}),
    };
  }
}

/** 进程内单例：弱网 attach 跨 WS 连接共享 */
export const streamSessionRegistry = new StreamSessionRegistry();
