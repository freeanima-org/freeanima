import { defineStore } from "pinia";
import { ref } from "vue";
import { marked } from "marked";
import { streamApiEventSchema, type StreamApiEvent } from "@freeanima/legacy-api";
import { sendMessageStream } from "../../api/client";

type SendCallbacks = {
  onToken?: (text: string) => void;
  onToolBegin?: (data: Record<string, unknown>) => void;
  onToolResult?: (data: Record<string, unknown>) => void;
  onToolError?: (data: Record<string, unknown>) => void;
  onAwaitingClarify?: (data: Record<string, unknown>) => void;
  onError?: (msg: string) => void;
  onDone?: () => void;
};

type ParsedSseEvent = { event: string; data: Record<string, unknown> };

export const useChatStore = defineStore("chat", () => {
  const streaming = ref(false);
  const streamingSessionId = ref<string | null>(null);
  const streamText = ref("");

  let _abortController: AbortController | null = null;

  function abortStream() {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    streaming.value = false;
    streamingSessionId.value = null;
  }

  function renderMd(text: string) {
    if (!text) return "";
    try {
      return marked.parse(text, { breaks: true, gfm: true }) as string;
    } catch {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
  }

  function parseSSE(buf: string): { parsed: ParsedSseEvent[]; remainder: string } {
    const parsed: ParsedSseEvent[] = [];
    const lines = buf.split("\n");
    const remainder = lines.pop() || "";
    let event = "";
    let data = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) event = line.slice(7);
      else if (line.startsWith("data: ")) data = line.slice(6);
      else if (line === "") {
        if (event) {
          try {
            const raw = JSON.parse(data) as unknown;
            const validated = streamApiEventSchema.safeParse({ event, data: raw });
            if (validated.success) {
              parsed.push(validated.data as StreamApiEvent);
            } else {
              parsed.push({ event, data: { raw: data } });
            }
          } catch {
            parsed.push({ event, data: { raw: data } });
          }
        }
        event = "";
        data = "";
      }
    }
    return { parsed, remainder };
  }

  async function send(sessionId: string, text: string, callbacks: SendCallbacks = {}) {
    const { onToken, onToolBegin, onToolResult, onToolError, onAwaitingClarify, onError, onDone } =
      callbacks;

    abortStream();

    const controller = new AbortController();
    _abortController = controller;

    streaming.value = true;
    streamingSessionId.value = sessionId;
    streamText.value = "";

    try {
      const r = await sendMessageStream(sessionId, text, controller.signal);
      if (!r.ok) {
        onError?.(`请求失败 (${r.status})`);
        return;
      }

      const reader = r.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let receivedDone = false;
      let receivedError = false;
      let doneNotified = false;
      const notifyDone = () => {
        if (doneNotified) return;
        doneNotified = true;
        receivedDone = true;
        onDone?.();
      };

      while (!receivedDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const { parsed, remainder } = parseSSE(buf);
        buf = remainder;

        for (const ev of parsed) {
          switch (ev.event) {
            case "token":
              streamText.value += (ev.data as { content?: string }).content || "";
              onToken?.(streamText.value);
              break;
            case "content_replace":
              streamText.value = (ev.data as { content?: string }).content || "";
              onToken?.(streamText.value);
              break;
            case "tool_begin":
              onToolBegin?.(ev.data as Record<string, unknown>);
              break;
            case "tool_result":
              onToolResult?.(ev.data as Record<string, unknown>);
              break;
            case "awaiting_clarify":
              onAwaitingClarify?.(ev.data as Record<string, unknown>);
              break;
            case "tool_error":
              onToolError?.(ev.data as Record<string, unknown>);
              break;
            case "error":
              receivedError = true;
              onError?.((ev.data as { error?: string }).error || "服务端错误");
              break;
            case "done":
              notifyDone();
              break;
          }
        }
      }

      if (buf.trim()) {
        const { parsed } = parseSSE(buf + "\n\n");
        for (const ev of parsed) {
          if (ev.event === "error") {
            receivedError = true;
            onError?.((ev.data as { error?: string }).error || "服务端错误");
          }
          if (ev.event === "done") {
            notifyDone();
          }
        }
      }

      if (!receivedDone) {
        if (streamText.value.trim()) {
          notifyDone();
        } else if (!receivedError) {
          onError?.("无回复，请检查 API 密钥与服务端日志");
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      console.error("send error:", e);
      onError?.("网络错误");
    } finally {
      streaming.value = false;
      streamingSessionId.value = null;
      _abortController = null;
    }
  }

  return { streaming, streamingSessionId, streamText, renderMd, send, abortStream };
});
