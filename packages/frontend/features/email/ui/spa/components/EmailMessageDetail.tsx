import { useEffect, useState, type ReactElement } from "react";
import { Button, Spinner } from "@freeanima/ui-kit";
import {
  ActionSheet,
  ContextMenu,
  EntityIdLabel,
  toast,
  useLongPress,
  type ActionSheetItem,
} from "@freeanima/ui-kit/composite";
import {
  useActionSheetCapability,
  useContextMenuCapability,
} from "@freeanima/client/portal-sdk/react.tsx";
import { hasNativeBlobSave, saveOrDownloadBlob } from "@freeanima/client/portal-sdk/save-blob.ts";

import {
  downloadEmailAttachmentBytes,
  type EmailAttachmentRow,
  type EmailMessageRow,
} from "../lib/api.ts";
import { buildEmailHtmlSrcDoc, looksLikeHtmlBody } from "../lib/email-html.ts";
import { EmailContactLinkPanel } from "./EmailContactLinkPanel.tsx";

function formatWhen(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(att: EmailAttachmentRow): boolean {
  return att.content_type.toLowerCase().startsWith("image/");
}

type EmailMessageDetailProps = {
  loading: boolean;
  message: EmailMessageRow | null;
  writesDisabled?: boolean;
  /** 发件箱不显示已读/未读操作 */
  showUnreadActions?: boolean;
  onReply?: () => void;
  onMarkUnread?: () => void;
  onMarkRead?: () => void;
  onCopyId?: () => void;
  onDelete?: () => void;
  onContactLinked?: (next: { from_contact_id: number | null; to_contact_ids: number[] }) => void;
};

function EmailAttachmentList({ attachments }: { attachments: EmailAttachmentRow[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function withBlob(att: EmailAttachmentRow, action: "download" | "preview") {
    setBusyId(att.file_id);
    setError(null);
    try {
      const blob = await downloadEmailAttachmentBytes(att.object_file_id);
      if (action === "download") {
        const result = await saveOrDownloadBlob(blob, att.filename);
        if (result.native && !result.cancelled) {
          toast("已保存");
        }
        return;
      }
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPreviewName(att.filename);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setError(`下载附件失败：${detail}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="border-border mb-4 space-y-2 rounded-md border p-3">
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {"附件"}
      </div>
      <ul className="space-y-2">
        {attachments.map((att) => (
          <li key={att.file_id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate" title={att.filename}>
              {att.filename}
              <span className="text-muted-foreground ml-2 text-xs">
                {formatSize(att.size)} · {att.content_type}
              </span>
            </span>
            <div className="flex gap-1">
              {isImageAttachment(att) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  isDisabled={busyId === att.file_id}
                  onClick={() => void withBlob(att, "preview")}
                >
                  {busyId === att.file_id ? <Spinner className="size-3" /> : "预览"}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                isDisabled={busyId === att.file_id}
                onClick={() => void withBlob(att, "download")}
              >
                {busyId === att.file_id && !isImageAttachment(att) ? (
                  <Spinner className="size-3" />
                ) : (
                  "下载"
                )}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {previewUrl ? (
        <div className="mt-2 space-y-1">
          <div className="text-muted-foreground text-xs">{previewName}</div>
          {hasNativeBlobSave() && previewName ? (
            <NativeImageSaveChrome
              onSave={() => {
                void (async () => {
                  try {
                    const blob = await (await fetch(previewUrl)).blob();
                    const result = await saveOrDownloadBlob(blob, previewName);
                    if (result.native && !result.cancelled) toast("已保存");
                  } catch (e) {
                    setError(`下载附件失败：${e instanceof Error ? e.message : String(e)}`);
                  }
                })();
              }}
            >
              <img
                src={previewUrl}
                alt={previewName ?? "预览"}
                className="border-border max-h-80 max-w-full rounded-md border object-contain"
              />
            </NativeImageSaveChrome>
          ) : (
            <img
              src={previewUrl}
              alt={previewName ?? "预览"}
              className="border-border max-h-80 max-w-full rounded-md border object-contain"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

/** 原生壳：右键 / 长按图片「另存为」（Web 保留系统菜单） */
function NativeImageSaveChrome({
  children,
  onSave,
}: {
  children: ReactElement;
  onSave: () => void;
}): ReactElement {
  const useSheet = useActionSheetCapability();
  const useMenu = useContextMenuCapability();
  const [sheetOpen, setSheetOpen] = useState(false);
  const items: ActionSheetItem[] = [{ label: "另存为", onClick: onSave }];
  const longPress = useLongPress({
    enabled: useSheet,
    onTrigger: () => setSheetOpen(true),
  });

  const wrapped = useMenu ? (
    <ContextMenu items={items}>{children}</ContextMenu>
  ) : useSheet ? (
    <div
      className="contents"
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
      onContextMenu={longPress.onContextMenu}
    >
      {children}
    </div>
  ) : (
    children
  );

  return (
    <>
      {wrapped}
      {sheetOpen ? (
        <ActionSheet title="图片" items={items} onClose={() => setSheetOpen(false)} />
      ) : null}
    </>
  );
}

export function EmailMessageDetail({
  loading,
  message,
  writesDisabled = false,
  showUnreadActions = true,
  onReply,
  onMarkUnread,
  onMarkRead,
  onCopyId,
  onDelete,
  onContactLinked,
}: EmailMessageDetailProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-sm">
        {"选择左侧邮件查看正文"}
      </div>
    );
  }

  const isHtml = message.content_type === "text/html" || looksLikeHtmlBody(message.body);
  const attachments = message.attachments ?? [];

  return (
    <article className="flex min-h-0 flex-1 flex-col overflow-hidden text-sm">
      <div className="border-border flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
        <EntityIdLabel id={message.id} animaComponent="email_message" />
        <div className="ml-auto flex flex-wrap gap-1">
          {onReply ? (
            <Button type="button" size="sm" isDisabled={writesDisabled} onClick={onReply}>
              {"回复"}
            </Button>
          ) : null}
          {showUnreadActions
            ? message.unread
              ? onMarkRead && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    isDisabled={writesDisabled}
                    onClick={onMarkRead}
                  >
                    {"标记为已读"}
                  </Button>
                )
              : onMarkUnread && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    isDisabled={writesDisabled}
                    onClick={onMarkUnread}
                  >
                    {"设为未读"}
                  </Button>
                )
            : null}
          {onCopyId ? (
            <Button type="button" size="sm" variant="ghost" onClick={onCopyId}>
              {"复制 ID"}
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              isDisabled={writesDisabled}
              onClick={onDelete}
            >
              {"删除邮件"}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="text-muted-foreground mb-4 space-y-1">
          <div>
            {"发件人："} {message.from}
            {onContactLinked ? (
              <EmailContactLinkPanel
                messageId={message.id}
                role="from"
                addressRaw={message.from}
                linkedContactId={message.from_contact_id ?? null}
                writesDisabled={writesDisabled}
                onLinked={onContactLinked}
              />
            ) : null}
          </div>
          <div>
            {"收件人："} {message.to}
            {onContactLinked ? (
              <EmailContactLinkPanel
                messageId={message.id}
                role="to"
                addressRaw={message.to}
                linkedContactId={message.to_contact_ids?.[0] ?? null}
                writesDisabled={writesDisabled}
                onLinked={onContactLinked}
              />
            ) : null}
          </div>
          <div>
            {"时间："} {formatWhen(message.sent_at)}
          </div>
        </div>
        {attachments.length > 0 ? <EmailAttachmentList attachments={attachments} /> : null}
        {isHtml && message.body ? (
          <iframe
            title={message.subject || "(无主题)"}
            className="border-border h-[min(70vh,48rem)] w-full rounded-md border bg-white"
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={buildEmailHtmlSrcDoc(message.body)}
          />
        ) : (
          <pre className="wrap-break-word whitespace-pre-wrap">{message.body || "(无正文)"}</pre>
        )}
      </div>
    </article>
  );
}
