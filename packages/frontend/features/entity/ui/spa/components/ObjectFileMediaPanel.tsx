import { useEffect, useState, type ReactElement } from "react";
import { Button, Spinner } from "@freeanima/ui-kit";
import {
  ActionSheet,
  ContextMenu,
  toast,
  useLongPress,
  type ActionSheetItem,
} from "@freeanima/ui-kit/composite";
import {
  useActionSheetCapability,
  useContextMenuCapability,
} from "@freeanima/client/portal-sdk/react.tsx";
import { hasNativeBlobSave, saveOrDownloadBlob } from "@freeanima/client/portal-sdk/save-blob.ts";
import { Download } from "lucide-react";

import {
  fetchObjectFileBlob,
  formatByteSize,
  objectFileMediaKind,
} from "../lib/object-file-blob.ts";

type ObjectFileMediaPanelProps = {
  objectFileId: number;
  title?: string;
  mimeType?: string | null;
  size?: number | null;
};

/**
 * object_file 媒体预览 + 下载：图片 / 音频 / 视频内嵌播放，其它类型仅下载。
 */
export function ObjectFileMediaPanel({
  objectFileId,
  title,
  mimeType,
  size,
}: ObjectFileMediaPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [resolvedMime, setResolvedMime] = useState(mimeType?.trim() || "");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError("");
    setObjectUrl(null);
    void (async () => {
      try {
        const blob = await fetchObjectFileBlob(objectFileId);
        if (cancelled) return;
        const mime = mimeType?.trim() || blob.type || "application/octet-stream";
        createdUrl = URL.createObjectURL(blob);
        setResolvedMime(mime);
        setObjectUrl(createdUrl);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [objectFileId, mimeType]);

  const kind = objectFileMediaKind(resolvedMime);
  const filename = (title?.trim() || `object_file-${objectFileId}`).slice(0, 200);

  const onDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      const blob = objectUrl
        ? await (await fetch(objectUrl)).blob()
        : await fetchObjectFileBlob(objectFileId);
      const result = await saveOrDownloadBlob(blob, filename);
      if (result.native && !result.cancelled) {
        toast("已保存");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  };

  const imagePreview = objectUrl ? (
    <img
      src={objectUrl}
      alt={filename}
      className="mx-auto max-h-80 max-w-full rounded-md border object-contain"
    />
  ) : null;

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">媒体</span>
          {resolvedMime ? <span className="ml-2">{resolvedMime}</span> : null}
          {typeof size === "number" ? <span className="ml-2">{formatByteSize(size)}</span> : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          isDisabled={downloading || loading}
          onClick={() => void onDownload()}
        >
          {downloading ? (
            <Spinner className="size-3.5" />
          ) : (
            <>
              <Download className="size-3.5" aria-hidden />
              <span className="ml-1.5">下载</span>
            </>
          )}
        </Button>
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="size-5" />
        </div>
      ) : objectUrl && kind === "image" && imagePreview ? (
        hasNativeBlobSave() ? (
          <NativeImageSaveChrome onSave={() => void onDownload()}>
            {imagePreview}
          </NativeImageSaveChrome>
        ) : (
          imagePreview
        )
      ) : objectUrl && kind === "audio" ? (
        <audio src={objectUrl} controls className="w-full" preload="metadata">
          浏览器不支持音频预览
        </audio>
      ) : objectUrl && kind === "video" ? (
        <video
          src={objectUrl}
          controls
          className="mx-auto max-h-80 max-w-full rounded-md border"
          preload="metadata"
        >
          浏览器不支持视频预览
        </video>
      ) : (
        <p className="text-muted-foreground text-xs">此类型不支持内嵌预览，请使用下载。</p>
      )}
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
