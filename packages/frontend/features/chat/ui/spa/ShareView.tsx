import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";

import { Spinner } from "@freeanima/ui-kit";
import { renderMarkdownHtml } from "@freeanima/ui-kit/lib/markdown.ts";

import {
  fetchPublicConversationShare,
  type ConversationShareSnapshotView,
} from "@freeanima/features/chat/ui/spa/lib/share-api.ts";
import type { DisplayItem } from "@freeanima/features/chat/ui/spa/lib/types.ts";

function formatExpiresAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ShareMessageList({ display }: { display: DisplayItem[] }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      {display.map((item, i) => {
        if (item.type === "message") {
          const alignEnd = item.role === "user";
          return (
            <div
              key={`s${i}`}
              className={`flex w-full ${alignEnd ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`chat-bubble max-w-[min(100%,42rem)] ${
                  alignEnd ? "chat-bubble-user" : "chat-bubble-assistant"
                }`}
              >
                <div
                  className="md-content min-w-0 max-w-full"
                  dangerouslySetInnerHTML={{ __html: renderMarkdownHtml(item.content) }}
                />
              </div>
            </div>
          );
        }
        if (item.type === "tool_block") {
          return (
            <div key={`s${i}`} className="text-muted-foreground text-xs">
              {`工具调用 × ${item.calls.length}`}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/** 公开临时分享只读页（无 AppFrame / 无需登录） */
export function ShareView() {
  const { shareId } = useParams({ strict: false }) as { shareId?: string };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ConversationShareSnapshotView | null>(null);

  useEffect(() => {
    if (!shareId?.trim()) {
      setLoading(false);
      setError("无效的分享链接");
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchPublicConversationShare(shareId)
      .then((data) => {
        if (cancelled) return;
        setSnapshot(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "分享链接已失效或不存在");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
      <header className="border-b border px-4 py-3">
        <p className="text-muted-foreground text-xs">{"临时分享"}</p>
        <h1 className="truncate text-base font-medium">{snapshot?.title?.trim() || "对话分享"}</h1>
        {snapshot?.expires_at ? (
          <p className="text-muted-foreground mt-1 text-xs">
            {`有效期至 ${formatExpiresAt(snapshot.expires_at)}`}
          </p>
        ) : null}
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : null}
        {error ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        ) : null}
        {!loading && !error && snapshot ? <ShareMessageList display={snapshot.display} /> : null}
      </main>
    </div>
  );
}

export default ShareView;
