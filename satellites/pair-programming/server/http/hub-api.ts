import type { SapClient } from "@freeanima/sap-contract";
import { streamEventMethods, mapSapStreamMethodToApi } from "@freeanima/sap-contract";
import { getStudioConfig } from "../studio.ts";
import { getSapClient } from "../sap/hub.ts";
import { jsonResponse } from "./cors.ts";

const PLATFORM = "studio-pair-programming";

function hubUrl(): string {
  return process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658";
}

async function sap(): Promise<SapClient> {
  return getSapClient(hubUrl());
}

function mapSessionList(raw: {
  sessions: Array<{
    session_id: string;
    title?: string;
    platform?: string;
    updated_at?: string;
  }>;
}) {
  return {
    sessions: raw.sessions.map((s) => ({
      id: s.session_id,
      title: s.title ?? "",
      platform: s.platform ?? PLATFORM,
      created: s.updated_at ?? "",
    })),
  };
}

export async function handleHubApi(req: Request, url: URL): Promise<Response | null> {
  const path = url.pathname;

  if (path === "/api/sessions" && req.method === "GET") {
    const platform = url.searchParams.get("platform") ?? PLATFORM;
    const result = await (await sap()).request("session.list", { platform });
    return jsonResponse(mapSessionList(result));
  }

  if (path === "/api/sessions" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { platform?: string };
    const cfg = getStudioConfig();
    const result = await (
      await sap()
    ).request("session.create", {
      platform: body.platform ?? PLATFORM,
      workspace_root: cfg.workspace || undefined,
      workspace_gitignore: cfg.gitignore,
      workspace_show_hidden: cfg.showHidden,
    });
    return jsonResponse({ session_id: result.session_id });
  }

  const messagesMatch = /^\/api\/sessions\/([^/]+)\/messages$/.exec(path);
  if (messagesMatch && req.method === "GET") {
    const sessionId = decodeURIComponent(messagesMatch[1] ?? "");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const limit = Number(url.searchParams.get("limit") ?? "500");
    const result = await (
      await sap()
    ).request("session.messages", {
      session_id: sessionId,
      offset,
      limit,
    });
    return jsonResponse(result);
  }

  const titleMatch = /^\/api\/sessions\/([^/]+)\/title$/.exec(path);
  if (titleMatch && req.method === "PATCH") {
    const sessionId = decodeURIComponent(titleMatch[1] ?? "");
    const body = (await req.json()) as { title?: string };
    const title = body.title?.trim();
    if (!title) {
      return jsonResponse({ error: "title required" }, 400);
    }
    await (await sap()).request("session.patchTitle", { session_id: sessionId, title });
    return jsonResponse({ ok: true });
  }

  if (path === "/api/messages/stream" && req.method === "POST") {
    return handleMessageStream(req);
  }

  return null;
}

async function handleMessageStream(req: Request): Promise<Response> {
  const body = (await req.json()) as { sessionId?: string; message?: string };
  const sessionId = body.sessionId?.trim();
  const message = body.message?.trim();
  if (!sessionId || !message) {
    return jsonResponse({ error: "sessionId and message required" }, 400);
  }

  const client = await sap();
  const { stream_id: streamId } = await client.request("message.send", {
    session_id: sessionId,
    message,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const cleanups: Array<() => void> = [];
      let closed = false;

      const closeStream = (): void => {
        if (closed) return;
        closed = true;
        for (const off of cleanups) off();
        controller.close();
      };

      const emit = (event: string, data: unknown): void => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      for (const method of streamEventMethods) {
        cleanups.push(
          client.onEvent(method, (payload) => {
            const record = payload as Record<string, unknown>;
            if (record.stream_id !== streamId) return;
            const apiEvent = mapSapStreamMethodToApi(method, record);
            if (!apiEvent) return;
            if (apiEvent.event === "ping") return;
            emit(apiEvent.event, apiEvent.data);
            if (apiEvent.event === "done" || apiEvent.event === "error") {
              closeStream();
            }
          }),
        );
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
