import { useEffect, useState } from "react";
import type { DisplayAttachment } from "@freeanima/shared/rpc-contract/frames/display";

/** 聊天附件缩略图：仅乐观 previewUrl（无 object_file 的临时附件） */
export function ChatAttachmentThumb({ att }: { att: DisplayAttachment }) {
  const [src, setSrc] = useState<string | null>(att.previewUrl ?? null);

  useEffect(() => {
    setSrc(att.previewUrl ?? null);
  }, [att.previewUrl]);

  return (
    <li className="max-w-[10rem] overflow-hidden rounded-md border border bg-background/50">
      {src && att.mime_type.startsWith("image/") ? (
        <img src={src} alt={att.filename} className="max-h-32 w-full object-cover" />
      ) : null}
      <div
        className="truncate px-2 py-1 text-[11px] opacity-80"
        title={`${att.filename} (${att.size} 字节)`}
      >
        {att.filename}
      </div>
    </li>
  );
}
