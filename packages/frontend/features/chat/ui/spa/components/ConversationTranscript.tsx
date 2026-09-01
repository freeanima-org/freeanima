import {
  Fragment,
  memo,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from "react";
import type { SpeechUnsupportedReason } from "@freeanima/client/portal-sdk/speech/adapter-types";
import {
  speechMessageKey as defaultSpeechMessageKey,
  speechStreamKey as defaultSpeechStreamKey,
} from "@freeanima/client/portal-sdk/speech/speech-playback-service";
import { Spinner } from "@freeanima/ui-kit";
import { renderMarkdownHtml } from "@freeanima/ui-kit/lib/markdown.ts";

import { ChatMessageBubble, findLastUserMessageIndex } from "./ChatMessageBubble.tsx";
import { ChatAttachmentThumb } from "./ChatAttachmentThumb.tsx";
import { MessageActionBar } from "./MessageActionBar.tsx";
import { ToolBlockBubble } from "./ToolBlockBubble.tsx";
import { useAnimaReferenceLabels } from "../hooks/useAnimaReferenceLabels.ts";
import { useLoadOlderOnScrollTop } from "../hooks/useLoadOlderOnScrollTop.ts";
import {
  useStickToBottomScroll,
  type TranscriptScrollApi,
} from "../hooks/useStickToBottomScroll.ts";
import { markdownToPlainText } from "../lib/speech/plain-text.ts";
import { createSpeechPlaceholders } from "../lib/speech/speech-placeholders.ts";
import type { DisplayItem, DisplayMessageItem } from "../lib/types.ts";

function SelectionDot({ selected, onToggle }: { selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`mt-2 size-5 shrink-0 rounded-full border text-[10px] leading-none ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40 bg-background text-transparent"
      }`}
      aria-label={selected ? "取消选择" : "选择"}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      ✓
    </button>
  );
}

export type TranscriptSpeechApi = {
  supported: boolean;
  unsupportedReason?: SpeechUnsupportedReason | null;
  isSpeaking: (key: string) => boolean;
  toggle: (key: string, text: string) => void;
  stopKeepEnabled?: () => void;
  messageKey?: (conversationId: string, index: number) => string;
  streamKey?: (conversationId: string) => string;
  /** 流式自动朗读进行中 */
  isStreamSpeaking?: boolean;
};

export type TranscriptUserContext = {
  item: DisplayMessageItem;
  index: number;
};

export type ConversationTranscriptProps = {
  display: DisplayItem[];
  /** 切会话时 force 贴底 */
  conversationKey?: string | null;
  className?: string;

  streamText?: string;
  /** 正在等待 / 流式中（显示流式气泡或 composing） */
  streaming?: boolean;
  /** 流式文本是否应对用户可见（Chat：本会话 stream 已 attach） */
  streamVisible?: boolean;
  recovering?: boolean;

  loadingOlder?: boolean;
  hasMoreBefore?: boolean;
  messagesLoading?: boolean;
  onLoadOlder?: () => Promise<boolean>;

  speech?: TranscriptSpeechApi;
  /** 有则在末条可编辑 user 上显示编辑（Chat outbox / re-edit） */
  onEditUser?: (index: number, item: DisplayMessageItem) => void;
  canEditUser?: (index: number, item: DisplayMessageItem) => boolean;

  onAnimaUriClick?: (uri: string) => void;

  /** 覆盖整条 user 行（编辑态） */
  renderUserMessage?: (ctx: TranscriptUserContext) => ReactNode | null | undefined;
  renderAfterUser?: (ctx: TranscriptUserContext) => ReactNode;
  renderAfterAssistant?: (ctx: TranscriptUserContext) => ReactNode;

  empty?: ReactNode;
  loading?: ReactNode;
  footer?: ReactNode;

  /** 供父级在 stream 回调里调用 scrollDown / stick */
  scrollApiRef?: MutableRefObject<TranscriptScrollApi | null>;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  readSentinelRef?: RefObject<HTMLDivElement | null>;

  /** 多选分享：仅可选带 pos 的 message */
  selectionMode?: boolean;
  selectedPosSet?: ReadonlySet<number>;
  onToggleSelectPos?: (pos: number) => void;
};

function onMdClick(e: MouseEvent<HTMLDivElement>, onAnimaUriClick?: (uri: string) => void): void {
  if (!onAnimaUriClick) return;
  const target = e.target instanceof HTMLElement ? e.target : null;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- DOM 事件目标边界
  const anchor = target?.closest?.("a[data-anima-uri]") as HTMLAnchorElement | null;
  if (!anchor) return;
  e.preventDefault();
  const uri = anchor.getAttribute("data-anima-uri");
  if (uri) onAnimaUriClick(uri);
}

/**
 * Chat / Coding 共用消息列表 SSOT：气泡渲染 + stick-to-bottom + 向上懒加载。
 * 禁止各 SPA 再平行写一套 display.map。
 * memo：父级（如 compose 外其他 state）重渲时，props 未变则跳过整页气泡。
 */
export const ConversationTranscript = memo(function ConversationTranscript({
  display,
  conversationKey = null,
  className = "flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 space-y-4",
  streamText = "",
  streaming = false,
  streamVisible,
  recovering = false,
  loadingOlder = false,
  hasMoreBefore = false,
  messagesLoading = false,
  onLoadOlder,
  speech,
  onEditUser,
  canEditUser,
  onAnimaUriClick,
  renderUserMessage,
  renderAfterUser,
  renderAfterAssistant,
  empty,
  loading,
  footer,
  scrollApiRef,
  scrollContainerRef: externalScrollRef,
  readSentinelRef,
  selectionMode = false,
  selectedPosSet,
  onToggleSelectPos,
}: ConversationTranscriptProps) {
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = externalScrollRef ?? internalScrollRef;
  const animaLabels = useAnimaReferenceLabels(display, streamText);

  const renderMd = (text: string): string => renderMarkdownHtml(text, animaLabels);

  const streamIsVisible = streamVisible ?? (streaming && streamText.length > 0);
  const awaiting = streaming || streamIsVisible;

  const contentEpoch = `${display.length}:${streamText.length}:${awaiting ? 1 : 0}`;

  const { scrollApi, onScrollPosition } = useStickToBottomScroll(scrollContainerRef, {
    conversationKey,
    contentEpoch,
  });

  useLoadOlderOnScrollTop(scrollContainerRef, {
    conversationKey,
    hasMoreBefore,
    loadingOlder,
    messagesLoading,
    displayLength: display.length,
    ...(onLoadOlder ? { onLoadOlder } : {}),
    onScrollPosition,
  });

  useEffect(() => {
    if (!scrollApiRef) return () => {};
    scrollApiRef.current = scrollApi;
    return () => {
      scrollApiRef.current = null;
    };
  }, [scrollApi, scrollApiRef]);

  const lastUserIndex = useMemo(() => findLastUserMessageIndex(display), [display]);
  const lastAssistantIndex = useMemo(() => {
    for (let i = display.length - 1; i >= 0; i--) {
      const item = display[i];
      if (item?.type === "message" && item.role === "assistant") return i;
    }
    return -1;
  }, [display]);

  const msgKey = speech?.messageKey ?? defaultSpeechMessageKey;
  const streamKey = speech?.streamKey ?? defaultSpeechStreamKey;
  const streamSpeechText =
    streamIsVisible && streamText
      ? markdownToPlainText(streamText, createSpeechPlaceholders())
      : "";

  const showEmpty = !messagesLoading && display.length === 0 && !awaiting && empty != null;
  const showLoading = messagesLoading && loading != null;

  return (
    <div ref={scrollContainerRef} className={className}>
      {conversationKey && loadingOlder ? (
        <div className="flex justify-center py-2">
          <Spinner className="size-4" />
        </div>
      ) : null}

      {showLoading ? loading : null}
      {showEmpty ? empty : null}

      {display.map((item, i) => {
        if (item.type === "message" && item.role === "user") {
          const overridden = renderUserMessage?.({ item, index: i });
          if (overridden != null) {
            return <Fragment key={`d${i}`}>{overridden}</Fragment>;
          }
          const speechText = markdownToPlainText(item.content, createSpeechPlaceholders());
          const speechKey = conversationKey ? msgKey(conversationKey, i) : "";
          const editAllowed =
            onEditUser &&
            (canEditUser ? canEditUser(i, item) : i === lastUserIndex && !item.sendStatus);
          const messagePos = typeof item.pos === "number" ? item.pos : null;
          const canSelect = selectionMode && messagePos != null;
          const selected = messagePos != null && !!selectedPosSet?.has(messagePos);
          return (
            <div
              key={`d${i}`}
              className={`flex w-full max-w-full flex-col items-end ${canSelect ? "cursor-pointer" : ""}`}
              onClick={
                messagePos != null && canSelect
                  ? () => {
                      onToggleSelectPos?.(messagePos);
                    }
                  : undefined
              }
            >
              <div className="flex w-full max-w-full items-start justify-end gap-2">
                {messagePos != null && canSelect ? (
                  <SelectionDot
                    selected={selected}
                    onToggle={() => onToggleSelectPos?.(messagePos)}
                  />
                ) : null}
                <div className="flex w-full max-w-full flex-col items-end">
                  <ChatMessageBubble
                    align="end"
                    className={`chat-bubble-user${
                      item.sendStatus === "pending" || item.sendStatus === "sending"
                        ? " opacity-70"
                        : item.sendStatus === "stale" || item.sendStatus === "failed"
                          ? " border border-warning"
                          : ""
                    }`}
                  >
                    <div
                      className="md-content"
                      dangerouslySetInnerHTML={{ __html: renderMd(item.content) }}
                      onClick={(e) => onMdClick(e, onAnimaUriClick)}
                    />
                    {item.attachments && item.attachments.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-2" aria-label="附件">
                        {item.attachments.map((att, ai) => (
                          <ChatAttachmentThumb key={`${att.filename}-${ai}`} att={att} />
                        ))}
                      </ul>
                    ) : null}
                    {item.sendStatus === "pending" ? (
                      <p className="mt-1 text-xs opacity-70">{"待发送"}</p>
                    ) : null}
                    {item.sendStatus === "stale" ? (
                      <>
                        <p className="mt-1 text-xs text-warning">{"已过期"}</p>
                        <p className="text-xs text-warning/80">{"对话已在其他设备上继续"}</p>
                      </>
                    ) : null}
                    {item.sendStatus === "failed" ? (
                      <p className="mt-1 text-xs text-warning">{"发送失败"}</p>
                    ) : null}
                  </ChatMessageBubble>
                  {renderAfterUser?.({ item, index: i })}
                  {!selectionMode ? (
                    <MessageActionBar
                      align="end"
                      copyContent={item.content}
                      speechText={speechText}
                      speaking={!!conversationKey && !!speech?.isSpeaking(speechKey)}
                      speechSupported={speech?.supported ?? false}
                      {...(speech?.unsupportedReason != null
                        ? { speechUnsupportedReason: speech.unsupportedReason }
                        : {})}
                      onToggleSpeech={() => {
                        if (!conversationKey || !speech) return;
                        speech.toggle(speechKey, speechText);
                      }}
                      {...(editAllowed ? { onEdit: () => onEditUser?.(i, item) } : {})}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        }

        if (item.type === "message" && item.role === "assistant") {
          const speechText = markdownToPlainText(item.content, createSpeechPlaceholders());
          const messageKey = conversationKey ? msgKey(conversationKey, i) : "";
          const speakingAsStream =
            !!speech?.isStreamSpeaking && !streamIsVisible && i === lastAssistantIndex;
          const speaking =
            (!!conversationKey && !!speech?.isSpeaking(messageKey)) || speakingAsStream;
          const messagePos = typeof item.pos === "number" ? item.pos : null;
          const canSelect = selectionMode && messagePos != null;
          const selected = messagePos != null && !!selectedPosSet?.has(messagePos);
          return (
            <div
              key={`d${i}`}
              className={`flex w-full max-w-full flex-col items-start ${canSelect ? "cursor-pointer" : ""}`}
              onClick={
                messagePos != null && canSelect
                  ? () => {
                      onToggleSelectPos?.(messagePos);
                    }
                  : undefined
              }
            >
              <div className="flex w-full max-w-full items-start gap-2">
                {messagePos != null && canSelect ? (
                  <SelectionDot
                    selected={selected}
                    onToggle={() => onToggleSelectPos?.(messagePos)}
                  />
                ) : null}
                <div className="flex w-full max-w-full flex-col items-start">
                  <ChatMessageBubble align="start" className="chat-bubble-assistant">
                    <div
                      className="md-content"
                      dangerouslySetInnerHTML={{ __html: renderMd(item.content) }}
                      onClick={(e) => onMdClick(e, onAnimaUriClick)}
                    />
                    {item.attachments && item.attachments.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-2" aria-label="附件">
                        {item.attachments.map((att, ai) => (
                          <ChatAttachmentThumb key={`${att.filename}-${ai}`} att={att} />
                        ))}
                      </ul>
                    ) : null}
                  </ChatMessageBubble>
                  {renderAfterAssistant?.({ item, index: i })}
                  {!selectionMode ? (
                    <MessageActionBar
                      align="start"
                      copyContent={item.content}
                      speechText={speechText}
                      speaking={speaking}
                      speechSupported={speech?.supported ?? false}
                      {...(speech?.unsupportedReason != null
                        ? { speechUnsupportedReason: speech.unsupportedReason }
                        : {})}
                      onToggleSpeech={() => {
                        if (!conversationKey || !speech) return;
                        if (speakingAsStream || speech.isSpeaking(streamKey(conversationKey))) {
                          speech.stopKeepEnabled?.();
                          return;
                        }
                        speech.toggle(messageKey, speechText);
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        }

        if (item.type === "tool_block") {
          return (
            <div key={`d${i}`} className="flex max-w-full justify-start">
              <ToolBlockBubble calls={item.calls} />
            </div>
          );
        }

        return null;
      })}

      {awaiting ? (
        streamIsVisible && streamText ? (
          <div className="flex w-full max-w-full flex-col items-start">
            <div className="chat-bubble chat-bubble-assistant">
              <div
                className="md-content"
                dangerouslySetInnerHTML={{ __html: renderMd(streamText) }}
                onClick={(e) => onMdClick(e, onAnimaUriClick)}
              />
              <Spinner className="mt-1 size-3" />
            </div>
            <MessageActionBar
              align="start"
              copyContent={streamText}
              speechText={streamSpeechText}
              speaking={speech?.isStreamSpeaking ?? false}
              speechSupported={speech?.supported ?? false}
              {...(speech?.unsupportedReason != null
                ? { speechUnsupportedReason: speech.unsupportedReason }
                : {})}
              onToggleSpeech={() => {
                if (!conversationKey || !speech) return;
                if (speech.isStreamSpeaking) {
                  speech.stopKeepEnabled?.();
                  return;
                }
                speech.toggle(streamKey(conversationKey), streamSpeechText);
              }}
            />
          </div>
        ) : (
          <div className="flex justify-start">
            <div className="chat-bubble chat-bubble-assistant text-muted-foreground flex items-center gap-2 text-sm">
              <Spinner className="size-3" />
              {recovering && !streamIsVisible ? "等待结果…" : "正在撰写回复…"}
            </div>
          </div>
        )
      ) : null}

      {footer}
      {conversationKey && readSentinelRef ? (
        <div ref={readSentinelRef} className="h-px w-full shrink-0" aria-hidden />
      ) : null}
    </div>
  );
});
