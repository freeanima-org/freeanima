import type { SapClient } from "./router.ts";
import type { StreamApiLikeEvent } from "./frames/message.ts";
import { mapSapStreamMethodToApi, streamEventMethods } from "./frames/message.ts";
import type { ConversationCreateInput, ConversationListInput } from "./frames/conversation.ts";
import { formatSapPlatform } from "./naming.ts";

export type SubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
};

export type SapSessionStreamClient = {
  subscribeConversationEvents(
    conversationId: string,
    onUpdate: () => void,
  ): { unsubscribe: () => void };
  sendMessageStream(
    input: { conversationId: string; message: string; llmDebug?: boolean },
    callbacks: SubscribeCallbacks<StreamApiLikeEvent>,
  ): { unsubscribe: () => void };
  detach(): void;
};

export function createSapConversationStreamClient(
  whenClient: () => Promise<SapClient>,
): SapSessionStreamClient {
  const subscribedConversations = new Set<string>();
  const conversationListeners = new Map<string, Set<() => void>>();
  let conversationUpdatedOff: (() => void) | null = null;

  const notifyConversation = (conversationId: string): void => {
    for (const listener of conversationListeners.get(conversationId) ?? []) {
      listener();
    }
  };

  const resubscribeSessions = async (client: SapClient): Promise<void> => {
    for (const conversationId of subscribedConversations) {
      await client.request("conversation.subscribe", { conversation_id: conversationId });
    }
  };

  const attachSessionUpdated = (client: SapClient): void => {
    conversationUpdatedOff?.();
    conversationUpdatedOff = client.onEvent("conversation.updated", (payload) => {
      const record = payload as { conversation_id?: string };
      if (typeof record.conversation_id === "string") {
        notifyConversation(record.conversation_id);
      }
    });
  };

  const ensureSessionHooks = async (): Promise<SapClient> => {
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
          const { stream_id: streamId } = await client.request("message.send", {
            conversation_id: input.conversationId,
            message: input.message,
            ...(input.llmDebug ? { llm_debug: true } : {}),
          });

          for (const method of streamEventMethods) {
            cleanups.push(
              client.onEvent(method, (payload) => {
                if (closed) return;
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

export async function sapListConversations(client: SapClient, input: ConversationListInput = {}) {
  return client.request("conversation.list", input);
}

export async function sapCreateConversation(
  client: SapClient,
  appId: string,
  instanceId: string,
  input: Omit<ConversationCreateInput, "platform"> & { platform?: string } = {},
) {
  return client.request("conversation.create", {
    ...input,
    platform: input.platform ?? formatSapPlatform(appId, instanceId),
  });
}

export async function sapGetStoredMessages(
  client: SapClient,
  conversationId: string,
  opts?: { offset?: number; limit?: number },
) {
  return client.request("conversation.messages", {
    conversation_id: conversationId,
    offset: opts?.offset,
    limit: opts?.limit,
  });
}

export async function sapPatchConversationTitle(
  client: SapClient,
  conversationId: string,
  title: string,
) {
  return client.request("conversation.patchTitle", { conversation_id: conversationId, title });
}
