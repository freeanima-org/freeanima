import { useState, type FormEvent } from "react";
import { useChatStore } from "@/stores/chat.ts";

type Props = {
  onSend?: () => void;
};

export function ChatInput({ onSend }: Props) {
  const [text, setText] = useState("");
  const streaming = useChatStore((s) => s.streaming);
  const send = useChatStore((s) => s.send);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const value = text.trim();
    if (!value || streaming) return;
    setText("");
    await send(value);
    onSend?.();
  };

  return (
    <form className="chat-input-bar" onSubmit={(e) => void handleSubmit(e)}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="跟 Agent 说点什么…"
        disabled={streaming}
      />
      <button
        type="submit"
        className="text-xs text-white/80 hover:text-white disabled:opacity-40"
        disabled={streaming || !text.trim()}
      >
        发送
      </button>
    </form>
  );
}
