import type { RpcStreamClient } from "./router.ts";
import type { StreamApiLikeEvent } from "./frames/message.ts";
import { mapSapStreamMethodToApi, streamEventMethods } from "./frames/message.ts";
import type { ConversationCreateInput, ConversationListInput } from "./frames/conversation.ts";
import { formatRemotePlatform } from "./naming.ts";
import { HABITAT_RPC_MESSAGE_SEND_TIMEOUT_MS } from "@freeanima/shared/habitat-rpc";
import { omitUndefined } from "@freeanima/core/util";

export type SubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
  /** message.send / stream.attach 拿到 stream_id 后回调，供弱网 resume */
  onStreamId?: (streamId: string) => void;
};

export type SapSessionStreamClient = {
  subscribeConversationEvents(
    conversationId: string,
    onUpdate: () => void,
  ): { unsubscribe: () => void };
  subscribeInboxEvents(onUpdate: (conversationId: string) => void): { unsubscribe: () => void };
  sendMessageStream(
    input: {
      conversationId: string;
      message: string;
      llmDebug?: boolean;
      clientOpId?: string;
      expectedTailPos?: number;
      forceTail?: boolean;
    },
    callbacks: SubscribeCallbacks<StreamApiLikeEvent>,
  ): { unsubscribe: () => void };
  resumeMessageStream(
    streamId: string,
    callbacks: SubscribeCallbacks<StreamApiLikeEvent>,
  ): { unsubscribe: () => void };
  detach(): void;
};

function bindStreamEventListeners(
  client: RpcStreamClient,
  streamId: string,
  callbacks: SubscribeCallbacks<StreamApiLikeEvent>,
  finish: () => void,
  closed: () => boolean,
): Array<() => void> {
  const cleanups: Array<() => void> = [];
  for (const method of streamEventMethods) {
    cleanups.push(
      client.onEvent(method, (payload) => {
        if (closed()) return;
        const record = payload as Record<string, unknown>;
        if (record.stream_id !== streamId) return;
        const apiEvent = mapSapStreamMethodToApi(method, record);
        if (!apiEvent || apiEvent.event === "ping") return;
        callbacks.onData?.(apiEvent);
        if (apiEvent.event === "done" || apiEvent.event === "error") {
          finish();
        }
      }),
    );
  }
  return cleanups;
}

export function createSapConversationStreamClient(
  whenClient: () => Promise<RpcStreamClient>,
): SapSessionStreamClient {
  const subscribedConversations = new Set<string>();
  const conversationListeners = new Map<string, Set<() => void>>();
  const inboxListeners = new Set<(conversationId: string) => void>();
  let inboxSubscribed = false;
  let conversationUpdatedOff: (() => void) | null = null;

  const notifyConversation = (conversationId: string): void => {
    for (const listener of conversationListeners.get(conversationId) ?? []) {
      listener();
    }
    for (const listener of inboxListeners) {
      listener(conversationId);
    }
  };

  const resubscribeSessions = async (client: RpcStreamClient): Promise<void> => {
    for (const conversationId of subscribedConversations) {
      await client.request("conversation.subscribe", { conversation_id: conversationId });
    }
    if (inboxSubscribed) {
      await client.request("conversation.subscribeInbox", {});
    }
  };

  const attachSessionUpdated = (client: RpcStreamClient): void => {
    conversationUpdatedOff?.();
    conversationUpdatedOff = client.onEvent("conversation.updated", (payload) => {
      const record = payload as { conversation_id?: string };
      if (typeof record.conversation_id === "string") {
        notifyConversation(record.conversation_id);
      }
    });
  };

  const ensureSessionHooks = async (): Promise<RpcStreamClient> => {
    const client = await whenClient();
    attachSessionUpdated(client);
    await resubscribeSessions(client);
    return client;
  };

  return {
    subscribeConversationEvents(conversationId, onUpdate) {
      subscribedConversations.add(conversationId);
      let set = conversationListeners.get(conversationId);
      if (!set) {
        set = new Set();
        conversationListeners.set(conversationId, set);
      }
      set.add(onUpdate);

      void ensureSessionHooks().then((client) =>
        client.request("conversation.subscribe", { conversation_id: conversationId }),
      );

      return {
        unsubscribe: () => {
          set?.delete(onUpdate);
          if (set && set.size === 0) {
            conversationListeners.delete(conversationId);
            subscribedConversations.delete(conversationId);
          }
        },
      };
    },
    subscribeInboxEvents(onUpdate) {
      inboxListeners.add(onUpdate);
      inboxSubscribed = true;
      void ensureSessionHooks().then((client) => client.request("conversation.subscribeInbox", {}));
      return {
        unsubscribe: () => {
          inboxListeners.delete(onUpdate);
          if (inboxListeners.size === 0) {
            inboxSubscribed = false;
          }
        },
      };
    },
    sendMessageStream(input, callbacks) {
      let closed = false;
      const cleanups: Array<() => void> = [];

      const finish = (): void => {
        if (closed) return;
        closed = true;
        for (const off of cleanups) off();
        callbacks.onComplete?.();
      };

      void (async () => {
        try {
          const client = await ensureSessionHooks();
          const { stream_id: streamId } = await client.request(
            "message.send",
            omitUndefined({
              conversation_id: input.conversationId,
              message: input.message,
              llm_debug: input.llmDebug ? true : undefined,
              client_op_id: input.clientOpId,
              expected_tail_pos: input.expectedTailPos,
              force_tail: input.forceTail ? true : undefined,
            }),
            { timeoutMs: HABITAT_RPC_MESSAGE_SEND_TIMEOUT_MS },
          );
          callbacks.onStreamId?.(streamId);
          cleanups.push(
            ...bindStreamEventListeners(client, streamId, callbacks, finish, () => closed),
          );
        } catch (e) {
          if (!closed) {
            callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
            finish();
          }
        }
      })();

      return { unsubscribe: finish };
    },
    resumeMessageStream(streamId, callbacks) {
      let closed = false;
      const cleanups: Array<() => void> = [];

      const finish = (): void => {
        if (closed) return;
        closed = true;
        for (const off of cleanups) off();
        callbacks.onComplete?.();
      };

      void (async () => {
        try {
          const client = await ensureSessionHooks();
          // 先挂监听再 attach，才能收到同步 buffer dump
          cleanups.push(
            ...bindStreamEventListeners(client, streamId, callbacks, finish, () => closed),
          );
          callbacks.onStreamId?.(streamId);
          await client.request("stream.attach", { stream_id: streamId });
        } catch (e) {
          if (!closed) {
            callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
            finish();
          }
        }
      })();

      return { unsubscribe: finish };
    },
    detach(): void {
      conversationUpdatedOff?.();
      conversationUpdatedOff = null;
    },
  };
}

export async function sapListConversations(
  client: RpcStreamClient,
  input: ConversationListInput = {},
) {
  return client.request("conversation.list", input);
}

export async function sapCreateConversation(
  client: RpcStreamClient,
  appId: string,
  instanceId: string,
  input: Omit<ConversationCreateInput, "platform"> & { platform?: string } = {},
) {
  return client.request("conversation.create", {
    ...input,
    platform: input.platform ?? formatRemotePlatform(appId, instanceId),
  });
}

export async function sapGetStoredMessages(
  client: RpcStreamClient,
  conversationId: string,
  opts?: { offset?: number; limit?: number; before_pos?: number },
) {
  return client.request(
    "conversation.messages",
    omitUndefined({
      conversation_id: conversationId,
      offset: opts?.offset,
      limit: opts?.limit,
      before_pos: opts?.before_pos,
    }),
  );
}

export async function sapPatchConversationTitle(
  client: RpcStreamClient,
  conversationId: string,
  title: string,
) {
  return client.request("conversation.patchTitle", { conversation_id: conversationId, title });
}
