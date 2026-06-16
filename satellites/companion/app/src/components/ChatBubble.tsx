type Props = {
  text: string;
  className?: string;
};

export function ChatBubble({ text, className = "" }: Props) {
  if (!text.trim()) return null;
  return (
    <div className={`chat-bubble ${className}`} role="status">
      {text}
    </div>
  );
}
