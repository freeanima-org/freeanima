import { advanceBubble, fetchRuntimeState } from "@/lib/api.ts";
import { useCompanionStore } from "@/stores/companion.ts";
import type { MotionSlotId } from "@shared/companion-schema.ts";
import { useEffect, useState } from "react";

type BubbleView = {
  id: string;
  text: string;
};

export function TextBubbleOverlay() {
  const characterReady = useCompanionStore((s) => s.characterReady);
  const [bubble, setBubble] = useState<BubbleView | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!characterReady) return;

    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const state = await fetchRuntimeState();
        if (cancelled) return;
        setBubble(state.bubble.current);
        setPending(state.bubble.pending);

        const backend = useCompanionStore.getState().backendRef.current;
        for (const cmd of state.play) {
          backend?.playSlot(cmd.slot as MotionSlotId, cmd.motionId);
        }
      } catch {
        /* sidecar 暂不可用 */
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [characterReady]);

  if (!bubble) return null;

  const onClick = (): void => {
    void advanceBubble().then((res) => {
      setBubble(res.current);
      setPending((p) => Math.max(0, p - 1));
    });
  };

  return (
    <button
      type="button"
      className="chat-bubble absolute left-1/2 -translate-x-1/2 bottom-full mb-2 max-w-[90%] text-left cursor-pointer"
      onClick={onClick}
      title={pending > 1 ? `还有 ${pending - 1} 条，点击下一条` : "点击下一条"}
    >
      <span className="block text-xs leading-relaxed whitespace-pre-wrap">{bubble.text}</span>
      {pending > 1 ? (
        <span className="block text-[10px] text-white/50 mt-1">
          还有 {pending - 1} 条 · 点击切换
        </span>
      ) : null}
    </button>
  );
}
