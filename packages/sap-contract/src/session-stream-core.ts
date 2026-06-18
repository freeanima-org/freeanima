import type { SapClient } from "./router.ts";
import type { StreamApiLikeEvent } from "./frames/message.ts";
import { mapSapStreamMethodToApi, streamEventMethods } from "./frames/message.ts";
import type { SessionCreateInput, SessionListInput } from "./frames/session.ts";
import { formatSapPlatform } from "./naming.ts";

export type SubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
};

export type SapSessionStreamClient = {
  subscribeSessionEvents(sessionId: string, onUpdate: () => void): { unsubscribe: () => void };
  sendMessageStream(
    input: { sessionId: string; message: string },
    callbacks: SubscribeCallbacks<StreamApiLikeEvent>,
  ): { unsubscribe: () => void };
  detach(): void;
};

export function createSapSessionStreamClient(
  whenClient: () => Promise<SapClient>,
): SapSessionStreamClient {
  const subscribedSessions = new Set<string>();
  const sessionListeners = new Map<string, Set<() => void>>();
  let sessionUpdatedOff: (() => void) | null = null;

  const notifySession = (sessionId: string): void => {
    for (const listener of sessionListeners.get(sessionId) ?? []) {
      listener();
    }
  };

  const resubscribeSessions = async (client: SapClient): Promise<void> => {
    for (const sessionId of subscribedSessions) {
      await client.request("session.subscribe", { session_id: sessionId });
    }
  };

  const attachSessionUpdated = (client: SapClient): void => {
    sessionUpdatedOff?.();
    sessionUpdatedOff = client.onEvent("session.updated", (payload) => {
      const record = payload as { session_id?: string };
      if (typeof record.session_id === "string") {
        notifySession(record.session_id);
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
    subscribeSessionEvents(sessionId, onUpdate) {
      subscribedSessions.add(sessionId);
      let set = sessionListeners.get(sessionId);
      if (!set) {
        set = new Set();
        sessionListeners.set(sessionId, set);
      }
      set.add(onUpdate);

      void ensureSessionHooks().then((client) =>
        client.request("session.subscribe", { session_id: sessionId }),
      );

      return {
        unsubscribe: () => {
          set?.delete(onUpdate);
          if (set && set.size === 0) {
            sessionListeners.delete(sessionId);
            subscribedSessions.delete(sessionId);
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
            session_id: input.sessionId,
            message: input.message,
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
      sessionUpdatedOff?.();
      sessionUpdatedOff = null;
    },
  };
}

export async function sapListSessions(client: SapClient, input: SessionListInput = {}) {
  return client.request("session.list", input);
}

export async function sapCreateSession(
  client: SapClient,
  appId: string,
  instanceId: string,
  input: Omit<SessionCreateInput, "platform"> & { platform?: string } = {},
) {
  return client.request("session.create", {
    ...input,
    platform: input.platform ?? formatSapPlatform(appId, instanceId),
  });
}

export async function sapGetSessionMessages(
  client: SapClient,
  sessionId: string,
  opts?: { offset?: number; limit?: number },
) {
  return client.request("session.messages", {
    session_id: sessionId,
    offset: opts?.offset,
    limit: opts?.limit,
  });
}

export async function sapPatchSessionTitle(client: SapClient, sessionId: string, title: string) {
  return client.request("session.patchTitle", { session_id: sessionId, title });
}
