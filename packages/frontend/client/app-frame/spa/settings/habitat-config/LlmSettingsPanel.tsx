import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { Button, Card, CardContent } from "@freeanima/ui-kit";
import { EmptyState, ListRow, ModalSheetPresent, showConfirm } from "@freeanima/ui-kit/composite";
import { XIcon } from "lucide-react";
import {
  patchHabitatConfigSection,
  replaceHabitatConfigSection,
} from "@freeanima/client/portal-sdk/habitat-config-api";
import { useActionSheetCapability } from "@freeanima/client/portal-sdk/react";

import {
  habitatConfigBoolField,
  habitatConfigNumberField,
  readHabitatConfigRecord,
} from "./habitat-config-field-helpers.tsx";
import {
  capabilityUiDraftToSection,
  CONNECTION_LAYERS,
  connectionIdsForLayer,
  connectionListSubtitle,
  emptyConnectionEntry,
  llmEntryTitle,
  newConnectionId,
  providersDraftToPatch,
  readCapabilityUiDraft,
  readProvidersDraft,
  readTimeoutDraft,
  validateTimeoutDraft,
  type CapabilityPanelFocus,
  type SceneBindingDraft,
} from "./llm-settings-draft.ts";
import { LlmConnectionEditorForm, LlmSystemScenesPanel } from "./llm-settings-forms.tsx";

type EditorState = {
  kind: "connection";
  mode: "create" | "edit";
  id: string;
  entry: Record<string, unknown>;
};

type Props = {
  config: Record<string, unknown>;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onError: (message: string) => void;
  onSaved: (section: string) => Promise<void>;
  panelFocus: "connections" | CapabilityPanelFocus;
};

function sceneBindingComplete(v: SceneBindingDraft | null | undefined): boolean {
  return Boolean(v?.connection?.trim() && v?.model?.trim());
}

export function LlmSettingsPanel({
  config,
  saving,
  onSavingChange,
  onError,
  onSaved,
  panelFocus,
}: Props) {
  const useActionSheet = useActionSheetCapability();
  const [providersDraft, setProvidersDraft] = useState<Record<string, unknown>>({});
  const [scenesDraft, setScenesDraft] = useState<Record<string, SceneBindingDraft | null>>({});
  const [embeddingExtra, setEmbeddingExtra] = useState({
    enabled: true,
    dimensions: "" as number | "",
    timeout_ms: "" as number | "",
    query_timeout_ms: "" as number | "",
  });
  const [editor, setEditor] = useState<EditorState | null>(null);

  const capabilityFocus: CapabilityPanelFocus | null =
    panelFocus === "connections" ? null : panelFocus;

  useEffect(() => {
    setProvidersDraft(
      readProvidersDraft(config.connections as Record<string, unknown> | undefined),
    );
    if (panelFocus !== "connections") {
      const raw = config[panelFocus];
      const section =
        raw && typeof raw === "object" && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : {};
      setScenesDraft(readCapabilityUiDraft(section, panelFocus));
      if (panelFocus === "embedding") {
        setEmbeddingExtra({
          enabled: section.enabled !== false,
          dimensions: typeof section.dimensions === "number" ? section.dimensions : "",
          timeout_ms: typeof section.timeout_ms === "number" ? section.timeout_ms : "",
          query_timeout_ms:
            typeof section.query_timeout_ms === "number" ? section.query_timeout_ms : "",
        });
      }
    }
  }, [config, panelFocus]);

  const providersRecord = useMemo(() => readHabitatConfigRecord(providersDraft), [providersDraft]);
  const connectionIds = useMemo(() => Object.keys(providersRecord).toSorted(), [providersRecord]);
  const connectionLabels = useMemo(() => {
    const out: Record<string, string> = {};
    for (const id of connectionIds) {
      out[id] = llmEntryTitle(id, providersRecord[id]);
    }
    return out;
  }, [connectionIds, providersRecord]);

  const onSceneChange = useCallback((purposeId: string, value: SceneBindingDraft | null) => {
    setScenesDraft((prev) => ({ ...prev, [purposeId]: value }));
  }, []);

  const saveCapability = useCallback(async () => {
    if (!capabilityFocus) return;
    onSavingChange(true);
    onError("");
    try {
      const rows = Object.entries(scenesDraft);
      const mainId =
        capabilityFocus === "text_generate"
          ? "chat"
          : capabilityFocus === "audio_generate"
            ? "voice_generate"
            : capabilityFocus === "image_generate"
              ? "image_generate"
              : capabilityFocus === "video_generate"
                ? "video_generate"
                : "embedding";
      if (!sceneBindingComplete(scenesDraft[mainId])) {
        onError("请为该能力的主场景选择连接与模型");
        return;
      }
      for (const [purpose, v] of rows) {
        if (purpose === mainId) continue;
        if (v != null && !sceneBindingComplete(v)) {
          onError("单独指定的子场景须同时填写连接与模型，或改回「同主场景」");
          return;
        }
      }
      const extra =
        capabilityFocus === "embedding"
          ? {
              enabled: embeddingExtra.enabled,
              ...(embeddingExtra.dimensions === ""
                ? {}
                : { dimensions: embeddingExtra.dimensions }),
              ...(embeddingExtra.timeout_ms === ""
                ? {}
                : { timeout_ms: embeddingExtra.timeout_ms }),
              ...(embeddingExtra.query_timeout_ms === ""
                ? {}
                : { query_timeout_ms: embeddingExtra.query_timeout_ms }),
            }
          : undefined;
      const section = capabilityUiDraftToSection(scenesDraft, capabilityFocus, extra);
      await replaceHabitatConfigSection(capabilityFocus, section);
      await onSaved(capabilityFocus);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  }, [capabilityFocus, scenesDraft, embeddingExtra, onError, onSaved, onSavingChange]);

  const isEditorValid = useCallback((): boolean => {
    if (!editor) return false;
    const id = editor.id.trim();
    if (!id) return false;
    if (validateTimeoutDraft(readTimeoutDraft(editor.entry))) return false;
    if (editor.mode === "create" && connectionIds.includes(id)) return false;
    return true;
  }, [editor, connectionIds]);

  const validateEditor = useCallback((): boolean => {
    if (!editor) return false;
    const id = editor.id.trim();
    if (!id) {
      onError("连接 id 无效");
      return false;
    }
    const timeoutErr = validateTimeoutDraft(readTimeoutDraft(editor.entry));
    if (timeoutErr) {
      onError(timeoutErr);
      return false;
    }
    if (editor.mode === "create" && connectionIds.includes(id)) {
      onError(`连接 id「${id}」已存在`);
      return false;
    }
    onError("");
    return true;
  }, [editor, connectionIds, onError]);

  const persistEditor = useCallback(async () => {
    if (!editor) return;
    if (!validateEditor()) return;
    onSavingChange(true);
    onError("");
    try {
      const id = editor.id.trim();
      const patched = providersDraftToPatch({ [id]: editor.entry });
      await patchHabitatConfigSection("connections", { [id]: patched[id] });
      setProvidersDraft((prev) => ({ ...readHabitatConfigRecord(prev), [id]: editor.entry }));
      await onSaved("connections");
      setEditor(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  }, [editor, validateEditor, onSaved, onSavingChange, onError]);

  const closeEditorPreservingDraft = useCallback(() => {
    onError("");
    if (editor && isEditorValid()) {
      setProvidersDraft((prev) => ({
        ...readHabitatConfigRecord(prev),
        [editor.id.trim()]: editor.entry,
      }));
    }
    setEditor(null);
  }, [editor, isEditorValid, onError]);

  const openCreateConnection = () => {
    setEditor({
      kind: "connection",
      mode: "create",
      id: newConnectionId(),
      entry: emptyConnectionEntry("text"),
    });
  };

  const deleteConnection = async (id: string) => {
    const label = llmEntryTitle(id, providersRecord[id]);
    const ok = await showConfirm({
      title: "删除连接？",
      description: `将移除连接「${label}」。`,
      confirmLabel: "删除",
      variant: "error",
    });
    if (!ok) return;
    const next = { ...providersRecord };
    delete next[id];
    setProvidersDraft(next);
    onSavingChange(true);
    onError("");
    try {
      await patchHabitatConfigSection("connections", { [id]: null });
      await onSaved("connections");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  };

  const editorTitle = editor?.mode === "create" ? "新建连接" : "编辑连接";

  const connectionsPanel = (
    <div className="space-y-6">
      {connectionIds.length === 0 ? (
        <EmptyState
          message="还没有连接"
          action={
            <Button type="button" size="sm" onClick={openCreateConnection}>
              新建连接
            </Button>
          }
        />
      ) : (
        CONNECTION_LAYERS.map((layer) => {
          const ids = connectionIdsForLayer(layer.id, connectionIds, providersRecord);
          if (ids.length === 0) return null;
          return (
            <div key={layer.id} className="space-y-2">
              <p className="text-sm font-medium">{layer.label}</p>
              <ul className="space-y-1">
                {ids.map((id) => {
                  const entry = providersRecord[id] ?? {};
                  return (
                    <ListRow
                      key={`${layer.id}-${id}`}
                      as="li"
                      useActionSheet={useActionSheet}
                      className="cursor-pointer bg-background/60 px-2"
                      onClick={() =>
                        setEditor({
                          kind: "connection",
                          mode: "edit",
                          id,
                          entry: { ...entry },
                        })
                      }
                    >
                      <div className="min-w-0 flex-1 py-1">
                        <p className="truncate text-sm font-medium">{llmEntryTitle(id, entry)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {connectionListSubtitle(entry)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive shrink-0"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          void deleteConnection(id);
                        }}
                      >
                        删除
                      </Button>
                    </ListRow>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
      {connectionIds.length > 0 ? (
        <Button type="button" size="sm" variant="outline" onClick={openCreateConnection}>
          新建连接
        </Button>
      ) : null}
    </div>
  );

  const scenesPanel = capabilityFocus ? (
    <div className="space-y-4">
      <LlmSystemScenesPanel
        scenesDraft={scenesDraft}
        onSceneChange={onSceneChange}
        connectionIds={connectionIds}
        connectionLabels={connectionLabels}
        providersById={providersRecord}
        purposeFocus={capabilityFocus}
      />
      {capabilityFocus === "embedding" ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">嵌入参数</p>
          {habitatConfigBoolField("启用向量检索", embeddingExtra.enabled, (enabled) =>
            setEmbeddingExtra((s) => ({ ...s, enabled })),
          )}
          {habitatConfigNumberField(
            "维度",
            embeddingExtra.dimensions,
            (dimensions) => setEmbeddingExtra((s) => ({ ...s, dimensions })),
            { hint: "默认 1024（bge-m3）" },
          )}
          {habitatConfigNumberField(
            "写入超时（毫秒）",
            embeddingExtra.timeout_ms,
            (timeout_ms) => setEmbeddingExtra((s) => ({ ...s, timeout_ms })),
            { hint: "默认 60000" },
          )}
          {habitatConfigNumberField(
            "查询超时（毫秒）",
            embeddingExtra.query_timeout_ms,
            (query_timeout_ms) => setEmbeddingExtra((s) => ({ ...s, query_timeout_ms })),
            { hint: "默认 800；失败则跳过召回" },
          )}
        </div>
      ) : null}
      <Button type="button" isDisabled={saving} onClick={() => void saveCapability()}>
        保存
      </Button>
    </div>
  ) : null;

  return (
    <Card className="bg-muted py-0">
      <CardContent className="gap-4 py-4">
        {panelFocus === "connections" ? connectionsPanel : scenesPanel}

        <ModalSheetPresent
          open={editor != null}
          onClose={closeEditorPreservingDraft}
          aria-label={editorTitle}
          className="max-w-3xl sm:max-w-3xl"
        >
          {editor ? (
            <div className="flex max-h-[85vh] min-w-0 flex-col">
              <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
                <p className="text-sm font-semibold">{editorTitle}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="关闭"
                  onClick={closeEditorPreservingDraft}
                >
                  <XIcon />
                </Button>
              </div>
              <div className="min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">
                <LlmConnectionEditorForm
                  connectionId={editor.id}
                  entry={editor.entry}
                  onChange={(entry) => setEditor({ ...editor, entry })}
                  testDisabled={saving}
                />
              </div>
              <div className="flex justify-end gap-2 border-t px-4 py-3">
                <Button type="button" variant="outline" onClick={closeEditorPreservingDraft}>
                  关闭
                </Button>
                <Button type="button" isDisabled={saving} onClick={() => void persistEditor()}>
                  {saving ? "保存中…" : "保存"}
                </Button>
              </div>
            </div>
          ) : null}
        </ModalSheetPresent>
      </CardContent>
    </Card>
  );
}
