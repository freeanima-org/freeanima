import { treaty } from "@elysiajs/eden";
import type { StreamApiEvent } from "@freeanima/connectors-webui/api";
import type { App } from "@freeanima/connectors-webui/elysia";
import { apiPath } from "./api-path.ts";

export const apiClient = treaty<App>(
  typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:2658",
);

type TreatyResult<T> = { data: T | null; error: unknown };

export async function unwrap<T>(promise: Promise<TreatyResult<T>>): Promise<T> {
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

export function subscribeMessageStream(
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

type TerminalStreamEvent = {
  type: string;
  sessionId?: string;
  data?: string;
  code?: number;
  message?: string;
};

export function subscribeTerminalStream(callbacks: SubscribeCallbacks<TerminalStreamEvent>): {
  unsubscribe: () => void;
} {
  const ws = apiClient.api.studio.terminal.ws.subscribe();
  let closed = false;

  ws.subscribe((message) => {
    if (closed) return;
    callbacks.onData?.(message as TerminalStreamEvent);
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

export async function listSessions(platform?: string) {
  return unwrap(apiClient.api.sessions.get({ query: { platform } }));
}

export async function listAllSessions() {
  return unwrap(apiClient.api.sessions.all.get());
}

export async function createSession(platform?: string) {
  return unwrap(apiClient.api.sessions.post(platform ? { platform } : {}));
}

export async function getSessionMessages(sessionId: string, offset?: number, limit?: number) {
  return unwrap(
    apiClient.api.sessions({ sessionId }).messages.get({
      query: {
        offset: offset?.toString(),
        limit: limit?.toString(),
      },
    }),
  );
}

export async function setSessionTitle(sessionId: string, title: string) {
  return unwrap(apiClient.api.sessions({ sessionId }).title.patch({ title }));
}

export async function listSessionCommands(opts?: { all?: boolean; platform?: string }) {
  return unwrap(
    apiClient.api.sessions.commands.get({
      query: {
        all: opts?.all ? "true" : undefined,
        platform: opts?.platform,
      },
    }),
  );
}

export async function getStatus() {
  return unwrap(apiClient.api.status.get());
}

export async function getStatusConfig() {
  return unwrap(apiClient.api.status.config.get());
}

export async function getToolsStatus() {
  return unwrap(apiClient.api.status.tools.get());
}

export async function getPromptDebug(sessionId?: string) {
  return unwrap(
    apiClient.api.prompt.debug.get({
      query: sessionId ? { session_id: sessionId } : {},
    }),
  );
}

export async function getCronJobs() {
  return unwrap(apiClient.api.status["cron-jobs"].get());
}

export async function pauseCronJob(id: string) {
  return unwrap(apiClient.api.status["cron-jobs"]({ id }).pause.post());
}

export async function resumeCronJob(id: string) {
  return unwrap(apiClient.api.status["cron-jobs"]({ id }).resume.post());
}

export async function runCronJob(id: string) {
  return unwrap(apiClient.api.status["cron-jobs"]({ id }).run.post());
}

export async function restartService() {
  return unwrap(apiClient.api.status.restart.post());
}

export async function getEmailOverview() {
  return unwrap(apiClient.api.email.get());
}

export async function fetchEmailAccount(accountId: string) {
  return unwrap(apiClient.api.email({ accountId }).fetch.post());
}

export async function listAccountMessages(accountId: string, limit = 50) {
  return unwrap(apiClient.api.email({ accountId }).messages.get({ query: { limit } }));
}

export async function getEmailMessage(accountId: string, uid: number) {
  return unwrap(
    apiClient.api
      .email({ accountId })
      .messages({ uid: String(uid) })
      .get(),
  );
}

export async function markEmailRead(accountId: string, uid: number) {
  return unwrap(
    apiClient.api
      .email({ accountId })
      .messages({ uid: String(uid) })
      .read.post(),
  );
}

export async function searchMemory(input: {
  query: string;
  limit?: number;
  session_limit?: number;
  session?: string;
}) {
  return unwrap(apiClient.api.memory.search.post(input));
}

export async function countSemanticMemory() {
  return unwrap(apiClient.api.memory["semantic-memory"].count.post());
}

export async function listSemanticMemories(input: {
  query?: string;
  offset?: number;
  limit?: number;
  types?: string[];
  status?: string;
  source_session?: string;
}) {
  return unwrap(apiClient.api.memory.semantic.list.post(input));
}

export async function listLimbicMemories(input: {
  query?: string;
  offset?: number;
  limit?: number;
  session_id?: string;
  kind?: string;
}) {
  return unwrap(apiClient.api.memory.limbic.list.post(input));
}

export async function listAutobiographicalMemories(input: {
  query?: string;
  offset?: number;
  limit?: number;
  status?: string;
  significance?: string;
  source_session?: string;
}) {
  return unwrap(apiClient.api.memory.autobiographical.list.post(input));
}

export async function getFtsStatus() {
  return unwrap(apiClient.api.fts.status.get());
}

export async function startRebuildFtsIndex(opts?: { only_missing?: boolean }) {
  return unwrap(
    apiClient.api.fts.rebuild.post({
      only_missing: opts?.only_missing ?? true,
    }),
  );
}

export async function getRebuildFtsJobStatus() {
  return unwrap(apiClient.api.fts.rebuild.status.get());
}

export async function getSelfBlocks() {
  return unwrap(apiClient.api.self.blocks.get());
}

export async function getMcpStatus() {
  return unwrap(apiClient.api.mcp.status.get());
}

export async function startMcp(name: string) {
  return unwrap(apiClient.api.mcp({ name }).start.post());
}

export async function stopMcp(name: string) {
  return unwrap(apiClient.api.mcp({ name }).stop.post());
}

export async function startAllMcp() {
  return unwrap(apiClient.api.mcp["start-all"].post());
}

export async function stopAllMcp() {
  return unwrap(apiClient.api.mcp["stop-all"].post());
}

export async function getAcpStatus() {
  return unwrap(apiClient.api.acp.status.get());
}

export async function startAcp(name: string) {
  return unwrap(apiClient.api.acp({ name }).start.post());
}

export async function stopAcp(name: string) {
  return unwrap(apiClient.api.acp({ name }).stop.post());
}

export async function startAllAcp() {
  return unwrap(apiClient.api.acp["start-all"].post());
}

export async function stopAllAcp() {
  return unwrap(apiClient.api.acp["stop-all"].post());
}

export async function listCredentials() {
  return unwrap(apiClient.api.credentials.get());
}

export async function getCredentialDetail(path: string) {
  return unwrap(apiClient.api.credentials.detail.get({ query: { path } }));
}

export async function getStudioConfig() {
  return unwrap(apiClient.api.studio.config.get());
}

export async function patchStudioConfig(input: {
  workspace?: string;
  gitignore?: boolean;
  showHidden?: boolean;
}) {
  return unwrap(apiClient.api.studio.config.patch(input));
}

export async function getStudioTree() {
  return unwrap(apiClient.api.studio.tree.get());
}

export async function getStudioFile(path: string) {
  return unwrap(apiClient.api.studio.file.get({ query: { path } }));
}

export async function searchStudio(query: string) {
  return unwrap(apiClient.api.studio.search.post({ query }));
}

export async function terminalWrite(sessionId: string, data: string) {
  return unwrap(apiClient.api.studio.terminal({ sessionId }).write.post({ data }));
}

export async function terminalResize(sessionId: string, cols: number, rows: number) {
  return unwrap(apiClient.api.studio.terminal({ sessionId }).resize.post({ cols, rows }));
}

export async function terminalClose(sessionId: string) {
  return unwrap(apiClient.api.studio.terminal({ sessionId }).close.post());
}
