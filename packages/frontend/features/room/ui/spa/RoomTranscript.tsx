import { renderMarkdownHtml } from "@freeanima/ui-kit/lib/markdown.ts";
import type { RoomMessagePayload } from "@freeanima/shared/rpc-contract/frames/room.ts";
import { ChatMessageBubble } from "@freeanima/features/chat/ui/spa/components/ChatMessageBubble.tsx";

function weakLabel(publicId: string, display?: string): string {
  if (display?.trim()) return display.trim();
  if (publicId.length <= 10) return publicId;
  return `${publicId.slice(0, 6)}…`;
}

type RoomTranscriptProps = {
  messages: RoomMessagePayload[];
  selfPublicId: string | null;
  streamDraft?: { agent_public_id: string; text: string } | null;
};

/** 复用私聊气泡样式的群聊时间线（Room 消息模型，非 DisplayItem）。 */
export function RoomTranscript({ messages, selfPublicId, streamDraft }: RoomTranscriptProps) {
  return (
    <div className="chat-transcript flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
      {messages.map((msg) => {
        const mine = selfPublicId != null && msg.speaker_public_id === selfPublicId;
        const isMention = (msg.mention_public_ids?.length ?? 0) > 0;
        return (
          <div key={msg.id} className="flex w-full flex-col gap-1">
            {!mine ? (
              <div className="text-muted-foreground px-1 text-xs">
                {weakLabel(msg.speaker_public_id, msg.speaker_display_name)}
                {isMention ? (
                  <span className="text-primary ml-2">
                    @{(msg.mention_public_ids ?? []).map((id) => weakLabel(id)).join(" ")}
                  </span>
                ) : null}
              </div>
            ) : null}
            <ChatMessageBubble
              align={mine ? "end" : "start"}
              className={mine ? "chat-bubble-user" : "chat-bubble-assistant"}
              longPressEnabled={false}
            >
              <div
                className={`md-content max-w-full${isMention ? " ring-primary/30 rounded-sm ring-1" : ""}`}
                dangerouslySetInnerHTML={{ __html: renderMarkdownHtml(msg.text) }}
              />
            </ChatMessageBubble>
          </div>
        );
      })}
      {streamDraft ? (
        <div className="flex w-full flex-col gap-1">
          <div className="text-muted-foreground px-1 text-xs">
            {weakLabel(streamDraft.agent_public_id)}
            <span className="ml-2">流式中…</span>
          </div>
          <ChatMessageBubble
            align="start"
            className="chat-bubble-assistant"
            longPressEnabled={false}
          >
            <div
              className="md-content min-w-0 max-w-full"
              dangerouslySetInnerHTML={{
                __html: renderMarkdownHtml(streamDraft.text || "…"),
              }}
            />
          </ChatMessageBubble>
        </div>
      ) : null}
    </div>
  );
}
