import { treaty } from "@elysiajs/eden";
import type { StreamApiEvent } from "@freeanima/connectors-webui/api";
import type { App } from "@freeanima/connectors-webui/elysia";
import { apiPath } from "./api-path.ts";

const client = treaty<App>(
  typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:2658",
);

type TreatyResult<T> = { data: T | null; error: unknown };

async function unwrap<T>(promise: Promise<TreatyResult<T>>): Promise<T> {
  const result = await promise;
  if (result.error) {
    const err = result.error as { value?: unknown; message?: string };
    throw new Error(String(err.value ?? err.message ?? "请求失败"));
  }
  if (result.data === null || result.data === undefined) {
    throw new Error("空响应");
  }
  return result.data;
}

type SubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
};

function subscribeMessageStream(
  input: { sessionId: string; message: string },
  callbacks: SubscribeCallbacks<StreamApiEvent>,
): { unsubscribe: () => void } {
  const controller = new AbortController();

  void (async () => {
    try {
      const res = await fetch(apiPath("/api/messages/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!res.ok) {
        callbacks.onError?.(new Error(`HTTP ${res.status}`));
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        callbacks.onError?.(new Error("无响应流"));
        return;
      }
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          callbacks.onData?.(JSON.parse(json) as StreamApiEvent);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
    } finally {
      callbacks.onComplete?.();
    }
  })();

  return { unsubscribe: () => controller.abort() };
}

function subscribeTerminalStream(
  callbacks: SubscribeCallbacks<{
    type: string;
    sessionId?: string;
    data?: string;
    code?: number;
    message?: string;
  }>,
): { unsubscribe: () => void } {
  const ws = client.api.studio.terminal.ws.subscribe();
  let closed = false;

  ws.subscribe((message) => {
    if (closed) return;
    callbacks.onData?.(
      message as {
        type: string;
        sessionId?: string;
        data?: string;
        code?: number;
        message?: string;
      },
    );
  });

  ws.on("error", () => {
    if (closed) return;
    callbacks.onError?.(new Error("WebSocket 连接失败"));
  });

  ws.on("close", () => {
    if (closed) return;
    callbacks.onComplete?.();
  });

  return {
    unsubscribe: () => {
      closed = true;
      ws.close();
    },
  };
}

/** 与旧 tRPC 客户端形状兼容的 API  facade */
export const api = {
  sessions: {
    list: {
      query: (input?: { platform?: string }) => unwrap(client.api.sessions.get({ query: input })),
    },
    listAll: {
      query: () => unwrap(client.api.sessions.all.get()),
    },
    create: {
      mutate: (input?: { platform?: string }) => unwrap(client.api.sessions.post(input ?? {})),
    },
    messages: {
      query: (input: { sessionId: string; offset?: number; limit?: number }) =>
        unwrap(
          client.api.sessions({ sessionId: input.sessionId }).messages.get({
            query: {
              offset: input.offset?.toString(),
              limit: input.limit?.toString(),
            },
          }),
        ),
    },
    setTitle: {
      mutate: (input: { sessionId: string; title: string }) =>
        unwrap(
          client.api.sessions({ sessionId: input.sessionId }).title.patch({
            title: input.title,
          }),
        ),
    },
    commands: {
      query: (input?: { all?: boolean; platform?: string }) =>
        unwrap(
          client.api.sessions.commands.get({
            query: {
              all: input?.all ? "true" : undefined,
              platform: input?.platform,
            },
          }),
        ),
    },
  },
  messages: {
    sendStream: {
      subscribe: (
        input: { sessionId: string; message: string },
        callbacks: SubscribeCallbacks<StreamApiEvent>,
      ) => subscribeMessageStream(input, callbacks),
    },
  },
  status: {
    get: { query: () => unwrap(client.api.status.get()) },
    config: { query: () => unwrap(client.api.status.config.get()) },
    tools: { query: () => unwrap(client.api.status.tools.get()) },
    cronJobs: { query: () => unwrap(client.api.status["cron-jobs"].get()) },
    pauseCron: {
      mutate: (input: { id: string }) =>
        unwrap(client.api.status["cron-jobs"]({ id: input.id }).pause.post()),
    },
    resumeCron: {
      mutate: (input: { id: string }) =>
        unwrap(client.api.status["cron-jobs"]({ id: input.id }).resume.post()),
    },
    runCron: {
      mutate: (input: { id: string }) =>
        unwrap(client.api.status["cron-jobs"]({ id: input.id }).run.post()),
    },
    restart: { mutate: () => unwrap(client.api.status.restart.post()) },
  },
  memory: {
    search: {
      mutate: (input: {
        query: string;
        limit?: number;
        session_limit?: number;
        session?: string;
      }) => unwrap(client.api.memory.search.post(input)),
    },
    semanticMemoryCount: {
      mutate: () => unwrap(client.api.memory["semantic-memory"].count.post()),
    },
  },
  mcp: {
    status: { query: () => unwrap(client.api.mcp.status.get()) },
    start: {
      mutate: (input: { name: string }) =>
        unwrap(client.api.mcp({ name: input.name }).start.post()),
    },
    stop: {
      mutate: (input: { name: string }) => unwrap(client.api.mcp({ name: input.name }).stop.post()),
    },
    startAll: { mutate: () => unwrap(client.api.mcp["start-all"].post()) },
    stopAll: { mutate: () => unwrap(client.api.mcp["stop-all"].post()) },
  },
  acp: {
    status: { query: () => unwrap(client.api.acp.status.get()) },
    start: {
      mutate: (input: { name: string }) =>
        unwrap(client.api.acp({ name: input.name }).start.post()),
    },
    stop: {
      mutate: (input: { name: string }) => unwrap(client.api.acp({ name: input.name }).stop.post()),
    },
    startAll: { mutate: () => unwrap(client.api.acp["start-all"].post()) },
    stopAll: { mutate: () => unwrap(client.api.acp["stop-all"].post()) },
  },
  studio: {
    config: {
      get: { query: () => unwrap(client.api.studio.config.get()) },
      patch: {
        mutate: (input: { workspace?: string; gitignore?: boolean; showHidden?: boolean }) =>
          unwrap(client.api.studio.config.patch(input)),
      },
    },
    tree: { query: () => unwrap(client.api.studio.tree.get()) },
    file: {
      query: (input: { path: string }) =>
        unwrap(client.api.studio.file.get({ query: { path: input.path } })),
    },
    search: {
      mutate: (input: { query: string }) => unwrap(client.api.studio.search.post(input)),
    },
    terminal: {
      stream: {
        subscribe: (
          _input: undefined,
          callbacks: SubscribeCallbacks<{
            type: string;
            sessionId?: string;
            data?: string;
            code?: number;
            message?: string;
          }>,
        ) => subscribeTerminalStream(callbacks),
      },
      write: {
        mutate: (input: { sessionId: string; data: string }) =>
          unwrap(
            client.api.studio.terminal({ sessionId: input.sessionId }).write.post({
              data: input.data,
            }),
          ),
      },
      resize: {
        mutate: (input: { sessionId: string; cols: number; rows: number }) =>
          unwrap(
            client.api.studio.terminal({ sessionId: input.sessionId }).resize.post({
              cols: input.cols,
              rows: input.rows,
            }),
          ),
      },
      close: {
        mutate: (input: { sessionId: string }) =>
          unwrap(client.api.studio.terminal({ sessionId: input.sessionId }).close.post()),
      },
    },
  },
};

export { client as treatyClient };
