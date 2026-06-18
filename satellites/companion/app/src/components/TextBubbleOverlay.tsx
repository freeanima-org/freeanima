import { advanceBubble } from "@/lib/api.ts";
import { useRuntimeSocket } from "@/hooks/useRuntimeSocket.ts";
import { useCompanionStore } from "@/stores/companion.ts";

export function TextBubbleOverlay() {
  const characterReady = useCompanionStore((s) => s.characterReady);
  const bubble = useCompanionStore((s) => s.runtimeBubble);
  const pending = useCompanionStore((s) => s.runtimeBubblePending);

  useRuntimeSocket(characterReady);

  if (!bubble) return null;

  const onClick = (): void => {
    void advanceBubble();
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
