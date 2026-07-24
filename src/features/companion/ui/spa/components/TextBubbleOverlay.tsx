import { advanceBubbleLocal } from "@freeanima/features/companion/ui/spa/lib/runtime-local.ts";
import { useRemoteToolsHost } from "@freeanima/features/companion/ui/spa/hooks/useRemoteToolsHost.ts";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";

function advanceBubbleOnClick(): void {
  advanceBubbleLocal();
}

export function TextBubbleOverlay() {
  const bubble = useCompanionStore((s) => s.runtimeBubble);
  const pending = useCompanionStore((s) => s.runtimeBubblePending);

  // 模型未就绪也要 attach，否则 Agent tool.call 无宿主
  useRemoteToolsHost(true);

  if (!bubble) return null;

  return (
    <button
      type="button"
      className="companion-text-bubble absolute left-1/2 -translate-x-1/2 bottom-full mb-2 text-left cursor-pointer"
      onClick={advanceBubbleOnClick}
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
