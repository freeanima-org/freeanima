import type { StreamEvent } from "@freeanima/runtime/loop";
import { mapRuntimeStreamEventToSap } from "@freeanima/sap-contract";

export type SapStreamEmitter = (method: string, payload: Record<string, unknown>) => void;

/** Map runtime stream events to SAP stream.* evt payloads */
export function emitStreamEvent(emit: SapStreamEmitter, streamId: string, ev: StreamEvent): void {
  const mapped = mapRuntimeStreamEventToSap(streamId, {
    event: ev.event,
    data: ev.data as Record<string, unknown>,
  });
  if (mapped) {
    emit(mapped.method, mapped.payload);
  }
}

export async function* bridgeMessageStream(
  streamId: string,
  source: AsyncIterable<StreamEvent>,
): AsyncGenerator<{ method: string; payload: Record<string, unknown> }> {
  yield {
    method: "stream.accepted",
    payload: { stream_id: streamId },
  };
  for await (const ev of source) {
    const mapped = mapRuntimeStreamEventToSap(streamId, {
      event: ev.event,
      data: ev.data as Record<string, unknown>,
    });
    if (mapped) {
      yield mapped;
    }
  }
}

export async function* bridgeSessionUpdates(
  sessionId: string,
  watch: (cb: () => void) => () => void,
  signal: AbortSignal,
): AsyncGenerator<{ method: string; payload: Record<string, unknown> }> {
  let pending: (() => void) | null = null;
  const wake = (): void => {
    pending?.();
    pending = null;
  };
  const unwatch = watch(wake);
  try {
    while (!signal.aborted) {
      await new Promise<void>((resolve) => {
        pending = resolve;
      });
      if (signal.aborted) break;
      yield {
        method: "session.updated",
        payload: { session_id: sessionId },
      };
    }
  } finally {
    unwatch();
  }
}

/** Bridge WebUI SSE-shaped events through the same mapper (for existing HTTP routes) */
export async function* bridgeApiStreamEvents(
  streamId: string,
  source: AsyncIterable<{ event: string; data: string }>,
): AsyncGenerator<{ method: string; payload: Record<string, unknown> }> {
  yield {
    method: "stream.accepted",
    payload: { stream_id: streamId },
  };
  for await (const chunk of source) {
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(chunk.data) as Record<string, unknown>;
    } catch {
      data = {};
    }
    const mapped = mapRuntimeStreamEventToSap(streamId, {
      event: chunk.event,
      data,
    });
    if (mapped) {
      yield mapped;
    }
  }
}
