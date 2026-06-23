import { withSseKeepalive } from "./sse-keepalive.ts";

export type SseEvent = { event: string; data: string };

function formatSseChunk(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

/** 将异步事件流编码为 SSE Response */
export function sseResponse(source: AsyncIterable<SseEvent>, signal?: AbortSignal): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of withSseKeepalive(
          source,
          () => ({ event: "keepalive", data: "{}" }),
          signal,
        )) {
          if (signal?.aborted) break;
          controller.enqueue(encoder.encode(formatSseChunk(chunk.event, chunk.data)));
        }
      } catch {
        /* client disconnect */
      } finally {
        controller.close();
      }
    },
    cancel() {
      signal?.throwIfAborted?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
