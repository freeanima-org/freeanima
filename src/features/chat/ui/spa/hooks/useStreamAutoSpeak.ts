import { useCallback, useEffect, useRef } from "react";
import {
  extractCompletedSentences,
  extractRemainder,
} from "@freeanima/client/portal-sdk/speech/sentence-boundary";
import { speechStreamKey } from "@freeanima/client/portal-sdk/speech/speech-playback-service";
import { markdownToPlainText } from "@freeanima/features/chat/ui/spa/lib/speech/plain-text.ts";
import { createSpeechPlaceholders } from "@freeanima/features/chat/ui/spa/lib/speech/speech-placeholders.ts";

type UseStreamAutoSpeakArgs = {
  enabled: boolean;
  currentId: string | null;
  streamVisible: boolean;
  streamText: string;
  enqueue: (key: string, text: string) => void;
  stop: () => void;
  activeKey: string | null;
};

/**
 * 流式自动朗读（豆包式）：
 * - 开着时按句 FIFO 跟读当前会话流式回复
 * - 切会话停读且不补读错过内容
 * - 点停只清队列/停播，总开关不变；本 turn 不再入队，下一轮仍自动读
 */
export function useStreamAutoSpeak({
  enabled,
  currentId,
  streamVisible,
  streamText,
  enqueue,
  stop,
  activeKey,
}: UseStreamAutoSpeakArgs): {
  stopCurrentKeepEnabled: () => void;
  isStreamSpeaking: boolean;
} {
  const cursorRef = useRef(0);
  const suppressedTurnRef = useRef(false);
  const prevEnabledRef = useRef(enabled);
  const prevCurrentIdRef = useRef(currentId);
  const wasStreamVisibleRef = useRef(false);
  /** 流结束时 store 可能已清空 streamText，用此保留最后一帧以便 flush 尾句 */
  const lastStreamTextRef = useRef("");

  const stopCurrentKeepEnabled = useCallback(() => {
    suppressedTurnRef.current = true;
    stop();
  }, [stop]);

  useEffect(() => {
    const idChanged = prevCurrentIdRef.current !== currentId;
    prevCurrentIdRef.current = currentId;
    if (!idChanged) return;
    suppressedTurnRef.current = false;
    cursorRef.current = streamText.length;
  }, [currentId, streamText.length]);

  useEffect(() => {
    const wasEnabled = prevEnabledRef.current;
    prevEnabledRef.current = enabled;

    if (!wasEnabled && enabled) {
      suppressedTurnRef.current = false;
      cursorRef.current = streamText.length;
      return;
    }

    if (wasEnabled && !enabled) {
      stop();
      suppressedTurnRef.current = false;
    }
  }, [enabled, streamText.length, stop]);

  useEffect(() => {
    if (!enabled || !currentId || !streamVisible || suppressedTurnRef.current) return;

    lastStreamTextRef.current = streamText;

    // 新流清空文本或切会话后游标可能越界，钳到当前长度
    if (cursorRef.current > streamText.length) {
      cursorRef.current = streamText.length;
    }

    const key = speechStreamKey(currentId);
    const { sentences, nextIndex } = extractCompletedSentences(streamText, cursorRef.current);
    cursorRef.current = nextIndex;

    const placeholders = createSpeechPlaceholders();
    for (const sentence of sentences) {
      const plain = markdownToPlainText(sentence, placeholders).trim();
      if (plain) enqueue(key, plain);
    }

    wasStreamVisibleRef.current = true;
  }, [enabled, currentId, streamVisible, streamText, enqueue]);

  useEffect(() => {
    const wasVisible = wasStreamVisibleRef.current;

    if (streamVisible) {
      wasStreamVisibleRef.current = true;
      return;
    }

    if (wasVisible && enabled && currentId && !suppressedTurnRef.current) {
      const text = lastStreamTextRef.current;
      const rest = extractRemainder(text, cursorRef.current);
      cursorRef.current = text.length;
      const plain = markdownToPlainText(rest, createSpeechPlaceholders()).trim();
      if (plain) enqueue(speechStreamKey(currentId), plain);
    }

    wasStreamVisibleRef.current = false;
    suppressedTurnRef.current = false;
    lastStreamTextRef.current = "";
  }, [streamVisible, enabled, currentId, enqueue]);

  const isStreamSpeaking = !!currentId && activeKey === speechStreamKey(currentId);

  return { stopCurrentKeepEnabled, isStreamSpeaking };
}
