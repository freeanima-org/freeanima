import { create } from "zustand";
import type { StreamApiEvent } from "@/lib/types.ts";
import { subscribeMessageStream } from "@/lib/api.ts";

type ChatState = {
  sessionId: string | null;
  streaming: boolean;
  bubbleText: string;
  agentBubble: string;
  setSessionId: (id: string | null) => void;
  send: (text: string) => Promise<void>;
  setAgentBubble: (text: string) => void;
  clearAgentBubble: () => void;
};

let _unsubscribe: (() => void) | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  sessionId: null,
  streaming: false,
  bubbleText: "",
  agentBubble: "",

  setSessionId(id) {
    set({ sessionId: id });
  },

  setAgentBubble(text) {
    set({ agentBubble: text });
  },

  clearAgentBubble() {
    set({ agentBubble: "" });
  },

  async send(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    let sessionId = get().sessionId;
    if (!sessionId) {
      const { createSession } = await import("@/lib/api.ts");
      const created = await createSession();
      sessionId = created.session_id;
      set({ sessionId });
    }

    set({ streaming: true, bubbleText: trimmed, agentBubble: "" });

    if (_unsubscribe) {
      _unsubscribe();
      _unsubscribe = null;
    }

    let agentText = "";

    await new Promise<void>((resolve) => {
      const sub = subscribeMessageStream(
        { sessionId: sessionId!, message: trimmed },
        {
          onData: (ev: StreamApiEvent) => {
            if (ev.event === "token") {
              agentText += String(ev.data.content ?? "");
              set({ agentBubble: agentText });
            } else if (ev.event === "content_replace") {
              agentText = String(ev.data.content ?? "");
              set({ agentBubble: agentText });
            }
          },
          onComplete: () => resolve(),
          onError: () => resolve(),
        },
      );
      _unsubscribe = () => sub.unsubscribe();
    });

    set({ streaming: false });
    _unsubscribe = null;
  },
}));
