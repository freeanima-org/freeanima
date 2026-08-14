import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button, Textarea } from "@freeanima/ui-kit";
import {
  AUTO_PERSIST_LONG,
  createAutoPersistScheduler,
} from "@freeanima/ui-kit/lib/auto-persist-schedule.ts";
import { useEnterToSendCapability } from "@freeanima/client/portal-sdk/react.tsx";
import { toast } from "@freeanima/ui-kit/composite";

import { loadInputDraft, saveInputDraft } from "../lib/input-draft.ts";
import {
  applyAnimaMentionInsert,
  parseAnimaMentionTrigger,
  type AnimaMentionMenuEntry,
} from "../lib/anima-mention-menu.ts";
import { searchAnimaMentionEntities } from "../lib/anima-mention-search.ts";
import {
  buildSlashMenuEntries,
  type SlashCommandItem,
  type SlashMenuEntry,
} from "../lib/slash-command-menu.ts";
import {
  CHAT_ATTACHMENT_MAX_BYTES,
  createAttachmentDraft,
  filesFromClipboard,
  revokeAttachmentDraft,
  revokeAttachmentDrafts,
  type ChatAttachmentDraft,
} from "../lib/attachments.ts";
import { ComposeAttachmentStrip } from "./ComposeAttachmentStrip.tsx";

const INPUT_MIN_HEIGHT_PX = 36;
const INPUT_MAX_HEIGHT_PX = 192;

export type ChatComposeSendPayload = {
  text: string;
  drafts: ChatAttachmentDraft[];
};

export type ChatComposeFormProps = {
  conversationId: string | null;
  commandList: SlashCommandItem[];
  /** 窄视口：菜单走文档流，避免被 overflow 裁切 */
  menuInFlow: boolean;
  streamVisible: boolean;
  canSendOnline: boolean;
  onSend: (payload: ChatComposeSendPayload) => void | Promise<void>;
  onStopStreaming: () => void;
};

/**
 * 输入区独立 state，避免每个按键重渲 ChatApp / 整页 Transcript。
 */
export function ChatComposeForm({
  conversationId,
  commandList,
  menuInFlow,
  streamVisible,
  canSendOnline,
  onSend,
  onStopStreaming,
}: ChatComposeFormProps) {
  const enterToSend = useEnterToSendCapability();
  const msgInputRef = useRef<HTMLTextAreaElement>(null);
  const [inputText, setInputText] = useState(() => loadInputDraft(conversationId));
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;
  const caretRef = useRef(inputText.length);
  const [caret, setCaret] = useState(inputText.length);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [animaEntries, setAnimaEntries] = useState<AnimaMentionMenuEntry[]>([]);
  const [animaLoading, setAnimaLoading] = useState(false);
  const [attachmentDrafts, setAttachmentDrafts] = useState<ChatAttachmentDraft[]>([]);
  const attachmentDraftsRef = useRef(attachmentDrafts);
  attachmentDraftsRef.current = attachmentDrafts;

  const draftConversationIdRef = useRef(conversationId);
  draftConversationIdRef.current = conversationId;
  const prevConversationIdRef = useRef(conversationId);

  const inputDraftScheduler = useMemo(
    () =>
      createAutoPersistScheduler({
        ...AUTO_PERSIST_LONG,
        onFire: () => {
          saveInputDraft(draftConversationIdRef.current, inputTextRef.current);
        },
      }),
    [],
  );
  useEffect(() => () => inputDraftScheduler.flush(), [inputDraftScheduler]);

  const resizeInput = useCallback(() => {
    const el = msgInputRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.max(INPUT_MIN_HEIGHT_PX, Math.min(el.scrollHeight, INPUT_MAX_HEIGHT_PX));
    el.style.height = `${next}px`;
  }, []);

  const clearInputAndDraft = useCallback(
    (id: string | null) => {
      inputDraftScheduler.cancel();
      inputTextRef.current = "";
      setInputText("");
      caretRef.current = 0;
      setCaret(0);
      setAnimaEntries([]);
      revokeAttachmentDrafts(attachmentDraftsRef.current);
      setAttachmentDrafts([]);
      saveInputDraft(id, "");
      requestAnimationFrame(resizeInput);
    },
    [inputDraftScheduler, resizeInput],
  );

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const next: ChatAttachmentDraft[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
        toast(`附件过大：${file.name}`, { duration: 4000 });
        continue;
      }
      next.push(createAttachmentDraft(file));
    }
    if (next.length === 0) return;
    setAttachmentDrafts((prev) => [...prev, ...next]);
  }, []);

  useEffect(
    () => () => {
      revokeAttachmentDrafts(attachmentDraftsRef.current);
    },
    [],
  );

  useEffect(() => {
    const prevId = prevConversationIdRef.current;
    if (prevId && prevId !== conversationId) {
      inputDraftScheduler.cancel();
      saveInputDraft(prevId, inputTextRef.current);
    }
    prevConversationIdRef.current = conversationId;
    const draft = loadInputDraft(conversationId);
    inputTextRef.current = draft;
    setInputText(draft);
    caretRef.current = draft.length;
    setCaret(draft.length);
    setAnimaEntries([]);
    setSelectedIdx(0);
    requestAnimationFrame(resizeInput);
  }, [conversationId, inputDraftScheduler, resizeInput]);

  const slashMenuEntries = useMemo(
    () => buildSlashMenuEntries(inputText, commandList),
    [inputText, commandList],
  );
  const showCmdMenu = slashMenuEntries.length > 0;
  const animaTrigger = useMemo(() => {
    if (showCmdMenu) return null;
    return parseAnimaMentionTrigger(inputText, caret);
  }, [inputText, caret, showCmdMenu]);
  const showAnimaMenu = animaTrigger != null;

  useEffect(() => {
    setSelectedIdx((i) =>
      slashMenuEntries.length === 0 ? 0 : Math.min(i, slashMenuEntries.length - 1),
    );
  }, [slashMenuEntries]);

  useEffect(() => {
    if (!animaTrigger) {
      setAnimaEntries([]);
      setAnimaLoading(false);
      return () => {};
    }
    let cancelled = false;
    setAnimaLoading(true);
    const timer = window.setTimeout(() => {
      void searchAnimaMentionEntities(animaTrigger.query).then((rows) => {
        if (cancelled) return;
        setAnimaEntries(rows);
        setAnimaLoading(false);
        setSelectedIdx(0);
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [animaTrigger?.start, animaTrigger?.query]);

  const applySlashEntry = (entry: SlashMenuEntry) => {
    inputTextRef.current = entry.insertText;
    setInputText(entry.insertText);
    caretRef.current = entry.insertText.length;
    setCaret(entry.insertText.length);
    inputDraftScheduler.schedule();
    setSelectedIdx(0);
    requestAnimationFrame(() => {
      resizeInput();
      msgInputRef.current?.focus();
    });
  };

  const applyAnimaEntry = (entry: AnimaMentionMenuEntry) => {
    if (!animaTrigger) return;
    const pos = msgInputRef.current?.selectionStart ?? caretRef.current;
    const { next, caret: nextCaret } = applyAnimaMentionInsert(
      inputTextRef.current,
      animaTrigger.start,
      pos,
      entry.insertText,
    );
    inputTextRef.current = next;
    setInputText(next);
    caretRef.current = nextCaret;
    setCaret(nextCaret);
    setAnimaEntries([]);
    setSelectedIdx(0);
    inputDraftScheduler.schedule();
    requestAnimationFrame(() => {
      resizeInput();
      const el = msgInputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const syncCaretFromEl = (el: HTMLTextAreaElement) => {
    const next = el.selectionStart ?? 0;
    caretRef.current = next;
    // 仅在可能触发 [[ 选择器时写入 state，避免普通打字双倍 setState
    if (inputTextRef.current.includes("[[") || next !== caret) {
      setCaret(next);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const menuLen = showCmdMenu ? slashMenuEntries.length : showAnimaMenu ? animaEntries.length : 0;
    if (showCmdMenu || showAnimaMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, Math.max(menuLen - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey && !e.nativeEvent.isComposing) {
        if (showCmdMenu) {
          e.preventDefault();
          const entry = slashMenuEntries[selectedIdx];
          if (entry) applySlashEntry(entry);
          return;
        }
        if (showAnimaMenu) {
          const entry = animaEntries[selectedIdx];
          if (entry) {
            e.preventDefault();
            applyAnimaEntry(entry);
          }
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (showCmdMenu) {
          clearInputAndDraft(conversationId);
          setSelectedIdx(0);
          return;
        }
        if (showAnimaMenu && animaTrigger) {
          const pos = msgInputRef.current?.selectionStart ?? caretRef.current;
          const next = `${inputTextRef.current.slice(0, animaTrigger.start)}${inputTextRef.current.slice(pos)}`;
          inputTextRef.current = next;
          setInputText(next);
          caretRef.current = animaTrigger.start;
          setCaret(animaTrigger.start);
          setAnimaEntries([]);
          inputDraftScheduler.schedule();
          requestAnimationFrame(() => {
            resizeInput();
            const el = msgInputRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(animaTrigger.start, animaTrigger.start);
          });
          return;
        }
      }
    }
    if (!enterToSend) return;
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const text = inputTextRef.current.trim();
    const drafts = attachmentDraftsRef.current;
    if (!text && drafts.length === 0) return;
    if (drafts.length > 0 && !canSendOnline) {
      toast("离线时无法发送附件", { duration: 4000 });
      return;
    }
    const payload = { text, drafts: drafts.slice() };
    clearInputAndDraft(conversationId);
    void onSend(payload);
  };

  const menuClass = [
    "mb-1 h-48 overflow-y-auto rounded-lg border border bg-background shadow-lg",
    menuInFlow ? "relative z-10 shrink-0" : "absolute bottom-full left-0 right-0 z-10",
  ].join(" ");

  return (
    <form
      className="flex gap-2 items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const text = inputTextRef.current.trim();
        const drafts = attachmentDraftsRef.current;
        if (!text && drafts.length === 0) return;
        if (drafts.length > 0 && !canSendOnline) {
          toast("离线时无法发送附件", { duration: 4000 });
          return;
        }
        const payload = { text, drafts: drafts.slice() };
        clearInputAndDraft(conversationId);
        void onSend(payload);
      }}
    >
      <div className={menuInFlow ? "flex min-w-0 flex-1 flex-col" : "relative min-w-0 flex-1"}>
        {showCmdMenu ? (
          <ul className={menuClass}>
            {slashMenuEntries.map((entry, i) => (
              <li
                key={entry.label}
                className={[
                  "px-3 py-2 text-sm cursor-pointer flex items-baseline gap-2 hover:bg-muted",
                  i === selectedIdx ? "bg-primary/15" : "",
                ].join(" ")}
                onPointerDown={(ev) => {
                  ev.preventDefault();
                  applySlashEntry(entry);
                }}
              >
                <span className="font-mono font-medium shrink-0">{entry.label}</span>
                <span className="text-xs text-muted-foreground truncate">{entry.description}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {showAnimaMenu ? (
          <ul className={menuClass}>
            {animaLoading && animaEntries.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">{"搜索实体…"}</li>
            ) : null}
            {!animaLoading && animaEntries.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">{"无匹配实体"}</li>
            ) : null}
            {animaEntries.map((entry, i) => (
              <li
                key={entry.id}
                className={[
                  "px-3 py-2 text-sm cursor-pointer flex items-baseline gap-2 hover:bg-muted",
                  i === selectedIdx ? "bg-primary/15" : "",
                ].join(" ")}
                onPointerDown={(ev) => {
                  ev.preventDefault();
                  applyAnimaEntry(entry);
                }}
              >
                <span className="font-mono font-medium shrink-0">{entry.label}</span>
                <span className="text-xs text-muted-foreground truncate">{entry.description}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <ComposeAttachmentStrip
          drafts={attachmentDrafts}
          disabled={!canSendOnline && attachmentDrafts.length === 0 ? false : !canSendOnline}
          onAddFiles={addFiles}
          onRemove={(localId) => {
            setAttachmentDrafts((prev) => {
              const hit = prev.find((d) => d.localId === localId);
              if (hit) revokeAttachmentDraft(hit);
              return prev.filter((d) => d.localId !== localId);
            });
          }}
        />
        <Textarea
          ref={msgInputRef}
          value={inputText}
          onChange={(e) => {
            const next = e.target.value;
            inputTextRef.current = next;
            setInputText(next);
            const nextCaret = e.target.selectionStart ?? next.length;
            caretRef.current = nextCaret;
            setCaret(nextCaret);
            inputDraftScheduler.schedule();
            setSelectedIdx(0);
            resizeInput();
          }}
          onSelect={(e) => syncCaretFromEl(e.currentTarget)}
          onClick={(e) => syncCaretFromEl(e.currentTarget)}
          onPaste={(e) => {
            const files = filesFromClipboard(e.nativeEvent);
            if (files.length === 0) return;
            e.preventDefault();
            addFiles(files);
          }}
          rows={1}
          className="!min-h-9 h-9 max-h-48 w-full resize-none overflow-y-auto py-1.5 leading-5 [field-sizing:fixed]"
          placeholder={"输入消息（Enter 发送；/ 命令；[[ 引用；可粘贴图片/附件）"}
          onFocus={() => {
            requestAnimationFrame(() => {
              msgInputRef.current?.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
              });
            });
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <Button type="submit" isDisabled={!inputText.trim() && attachmentDrafts.length === 0}>
        {"发送"}
      </Button>
      {streamVisible ? (
        <Button
          type="button"
          variant="destructive"
          isDisabled={!canSendOnline}
          onClick={() => onStopStreaming()}
        >
          {"停止"}
        </Button>
      ) : null}
    </form>
  );
}
