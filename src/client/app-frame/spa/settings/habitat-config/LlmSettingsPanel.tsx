import { useCallback, useEffect, useMemo, useState, type Key } from "react";
import {
  Button,
  Card,
  CardContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@freeanima/ui-kit";
import { EmptyState, ListRow, ModalSheetPresent, showConfirm } from "@freeanima/ui-kit/composite";
import { XIcon } from "lucide-react";
import { patchHabitatConfigSection } from "@freeanima/client/portal-sdk/habitat-config-api";
import { useActionSheetCapability } from "@freeanima/client/portal-sdk/react";

import { readLlmRecordDraft } from "./habitat-advanced-forms.tsx";
import { readHabitatConfigRecord } from "./habitat-config-field-helpers.tsx";
import {
  connectionListSubtitle,
  emptyConnectionEntry,
  emptySceneEntry,
  profilesDraftToPatch,
  providersDraftToPatch,
  readProvidersDraft,
  readTimeoutDraft,
  sceneListSubtitle,
  validateTimeoutDraft,
} from "./llm-settings-draft.ts";
import {
  LlmConnectionEditorForm,
  LlmDefaultSceneForm,
  LlmSceneEditorForm,
} from "./llm-settings-forms.tsx";

type LlmTabId = "connections" | "scenes" | "default";

type EditorState =
  | { kind: "connection"; mode: "create" | "edit"; id: string; entry: Record<string, unknown> }
  | { kind: "scene"; mode: "create" | "edit"; id: string; entry: Record<string, unknown> };

type Props = {
  llmConfig: Record<string, unknown>;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onError: (message: string) => void;
  onSaved: (section: string) => Promise<void>;
};

export function LlmSettingsPanel({ llmConfig, saving, onSavingChange, onError, onSaved }: Props) {
  const useActionSheet = useActionSheetCapability();
  const [tab, setTab] = useState<LlmTabId>("connections");
  const [providersDraft, setProvidersDraft] = useState<Record<string, unknown>>({});
  const [profilesDraft, setProfilesDraft] = useState<Record<string, unknown>>({});
  const [defaultProfile, setDefaultProfile] = useState("chat");
  const [editor, setEditor] = useState<EditorState | null>(null);

  useEffect(() => {
    setProvidersDraft(
      readProvidersDraft(llmConfig.providers as Record<string, unknown> | undefined),
    );
    setProfilesDraft(readLlmRecordDraft(llmConfig.profiles));
    setDefaultProfile(
      typeof llmConfig.default_profile === "string" ? llmConfig.default_profile : "chat",
    );
  }, [llmConfig]);

  const connectionIds = useMemo(
    () => Object.keys(readHabitatConfigRecord(providersDraft)).toSorted(),
    [providersDraft],
  );
  const sceneIds = useMemo(
    () => Object.keys(readHabitatConfigRecord(profilesDraft)).toSorted(),
    [profilesDraft],
  );

  const saveGeneral = useCallback(async () => {
    onSavingChange(true);
    onError("");
    try {
      const id = defaultProfile.trim();
      if (!id) {
        onError("请选择默认场景");
        return;
      }
      await patchHabitatConfigSection("llm", { default_profile: id });
      await onSaved("llm");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  }, [defaultProfile, onError, onSaved, onSavingChange]);

  /** 静默校验（关闭时用）；不写 onError，避免拦关闭导致 Dialog FocusScope 崩。 */
  const isEditorValid = useCallback((): boolean => {
    if (!editor) return false;
    const id = editor.id.trim();
    if (!id) return false;
    if (editor.kind === "connection") {
      if (validateTimeoutDraft(readTimeoutDraft(editor.entry))) return false;
      if (editor.mode === "create" && connectionIds.includes(id)) return false;
    } else if (editor.mode === "create" && sceneIds.includes(id)) {
      return false;
    }
    return true;
  }, [editor, connectionIds, sceneIds]);

  const validateEditor = useCallback((): boolean => {
    if (!editor) return false;
    const id = editor.id.trim();
    if (!id) {
      onError(editor.kind === "connection" ? "请填写连接 id" : "请填写场景 id");
      return false;
    }
    if (editor.kind === "connection") {
      const timeoutErr = validateTimeoutDraft(readTimeoutDraft(editor.entry));
      if (timeoutErr) {
        onError(timeoutErr);
        return false;
      }
      if (editor.mode === "create" && connectionIds.includes(id)) {
        onError(`连接 id「${id}」已存在`);
        return false;
      }
    } else {
      if (editor.mode === "create" && sceneIds.includes(id)) {
        onError(`场景 id「${id}」已存在`);
        return false;
      }
    }
    onError("");
    return true;
  }, [editor, connectionIds, sceneIds, onError]);

  const computeUpdatedProviders = useCallback(
    (draft: Record<string, unknown>): Record<string, unknown> => {
      if (!editor || editor.kind !== "connection") return draft;
      const next = { ...readHabitatConfigRecord(draft) };
      next[editor.id.trim()] = editor.entry;
      return next;
    },
    [editor],
  );

  const computeUpdatedProfiles = useCallback(
    (draft: Record<string, unknown>): Record<string, unknown> => {
      if (!editor || editor.kind !== "scene") return draft;
      const next = { ...readHabitatConfigRecord(draft) };
      next[editor.id.trim()] = editor.entry;
      return next;
    },
    [editor],
  );

  const persistEditor = useCallback(async () => {
    if (!editor) return;
    if (!validateEditor()) return;
    const kind = editor.kind;
    onSavingChange(true);
    onError("");
    try {
      if (kind === "connection") {
        const nextDraft = computeUpdatedProviders(providersDraft);
        await patchHabitatConfigSection("llm", {
          providers: providersDraftToPatch(nextDraft),
        });
        setProvidersDraft(nextDraft);
        await onSaved("llm.providers");
      } else {
        const nextDraft = computeUpdatedProfiles(profilesDraft);
        await patchHabitatConfigSection("llm", {
          profiles: profilesDraftToPatch(nextDraft),
        });
        setProfilesDraft(nextDraft);
        await onSaved("llm.profiles");
      }
      setEditor(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  }, [
    editor,
    validateEditor,
    computeUpdatedProviders,
    computeUpdatedProfiles,
    providersDraft,
    profilesDraft,
    onSaved,
    onSavingChange,
    onError,
  ]);

  /** 关闭/遮罩Dismiss：始终关掉；仅内容有效时写回本地 draft（不拦关闭、不弹校验错误）。 */
  const closeEditorPreservingDraft = useCallback(() => {
    onError("");
    if (editor && isEditorValid()) {
      if (editor.kind === "connection") {
        setProvidersDraft((prev) => computeUpdatedProviders(prev));
      } else if (editor.kind === "scene") {
        setProfilesDraft((prev) => computeUpdatedProfiles(prev));
      }
    }
    setEditor(null);
  }, [editor, isEditorValid, computeUpdatedProviders, computeUpdatedProfiles, onError]);

  const deleteConnection = async (id: string) => {
    const ok = await showConfirm({
      title: "删除连接？",
      description: `将移除连接「${id}」。`,
      confirmLabel: "删除",
      variant: "error",
    });
    if (!ok) return;
    setProvidersDraft((prev) => {
      const next = { ...readHabitatConfigRecord(prev) };
      delete next[id];
      return next;
    });
    onSavingChange(true);
    onError("");
    try {
      await patchHabitatConfigSection("llm", {
        providers: providersDraftToPatch({
          ...readHabitatConfigRecord(providersDraft),
          [id]: undefined,
        }),
      });
      await onSaved("llm.providers");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  };

  const deleteScene = async (id: string) => {
    const ok = await showConfirm({
      title: "删除场景？",
      description: `将移除场景「${id}」。`,
      confirmLabel: "删除",
      variant: "error",
    });
    if (!ok) return;
    setProfilesDraft((prev) => {
      const next = { ...readHabitatConfigRecord(prev) };
      delete next[id];
      return next;
    });
    onSavingChange(true);
    onError("");
    try {
      await patchHabitatConfigSection("llm", {
        profiles: profilesDraftToPatch({
          ...readHabitatConfigRecord(profilesDraft),
          [id]: undefined,
        }),
      });
      await onSaved("llm.profiles");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  };

  const editorTitle =
    editor?.kind === "connection"
      ? editor.mode === "create"
        ? "新建连接"
        : "编辑连接"
      : editor?.kind === "scene"
        ? editor.mode === "create"
          ? "新建场景"
          : "编辑场景"
        : "";

  return (
    <Card className="bg-muted py-0">
      <CardContent className="gap-4 py-4">
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key: Key) => setTab(String(key) as LlmTabId)}
          className="w-full"
        >
          <TabsList variant="default" className="w-full justify-start">
            <TabsTrigger id="connections">连接</TabsTrigger>
            <TabsTrigger id="scenes">场景</TabsTrigger>
            <TabsTrigger id="default">默认</TabsTrigger>
          </TabsList>

          <TabsContent id="connections" className="space-y-4 pt-2">
            {connectionIds.length === 0 ? (
              <EmptyState
                message="还没有连接"
                action={
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      setEditor({
                        kind: "connection",
                        mode: "create",
                        id: "",
                        entry: emptyConnectionEntry(),
                      })
                    }
                  >
                    新建连接
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-1">
                {connectionIds.map((id) => {
                  const entry = readHabitatConfigRecord(providersDraft)[id] ?? {};
                  return (
                    <ListRow
                      key={id}
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
                        <p className="truncate text-sm font-medium">{id}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {connectionListSubtitle(entry)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive shrink-0"
                        onClick={(e) => {
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
            )}
            {connectionIds.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setEditor({
                    kind: "connection",
                    mode: "create",
                    id: "",
                    entry: emptyConnectionEntry(),
                  })
                }
              >
                新建连接
              </Button>
            ) : null}
          </TabsContent>

          <TabsContent id="scenes" className="space-y-4 pt-2">
            {sceneIds.length === 0 ? (
              <EmptyState
                message="还没有场景"
                action={
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      setEditor({
                        kind: "scene",
                        mode: "create",
                        id: "",
                        entry: emptySceneEntry(),
                      })
                    }
                  >
                    新建场景
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-1">
                {sceneIds.map((id) => {
                  const entry = readHabitatConfigRecord(profilesDraft)[id] ?? {};
                  return (
                    <ListRow
                      key={id}
                      as="li"
                      useActionSheet={useActionSheet}
                      className="cursor-pointer bg-background/60 px-2"
                      onClick={() =>
                        setEditor({
                          kind: "scene",
                          mode: "edit",
                          id,
                          entry: { ...entry },
                        })
                      }
                    >
                      <div className="min-w-0 flex-1 py-1">
                        <p className="truncate text-sm font-medium">{id}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {sceneListSubtitle(entry)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteScene(id);
                        }}
                      >
                        删除
                      </Button>
                    </ListRow>
                  );
                })}
              </ul>
            )}
            {sceneIds.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setEditor({
                    kind: "scene",
                    mode: "create",
                    id: "",
                    entry: emptySceneEntry(),
                  })
                }
              >
                新建场景
              </Button>
            ) : null}
          </TabsContent>

          <TabsContent id="default" className="space-y-4 pt-2">
            <LlmDefaultSceneForm
              defaultProfile={defaultProfile}
              sceneIds={sceneIds}
              onDefaultProfileChange={setDefaultProfile}
            />
            <Button type="button" isDisabled={saving} onClick={() => void saveGeneral()}>
              保存默认
            </Button>
          </TabsContent>
        </Tabs>

        <ModalSheetPresent
          open={editor != null}
          onClose={closeEditorPreservingDraft}
          aria-label={editorTitle}
          className="sm:max-w-xl"
        >
          {editor ? (
            <div className="flex max-h-[85vh] flex-col">
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
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {editor.kind === "connection" ? (
                  <LlmConnectionEditorForm
                    connectionId={editor.id}
                    idEditable={editor.mode === "create"}
                    entry={editor.entry}
                    onIdChange={(id) => setEditor({ ...editor, id })}
                    onChange={(entry) => setEditor({ ...editor, entry })}
                    testDisabled={saving}
                  />
                ) : (
                  <LlmSceneEditorForm
                    sceneId={editor.id}
                    idEditable={editor.mode === "create"}
                    entry={editor.entry}
                    connectionIds={connectionIds}
                    onIdChange={(id) => setEditor({ ...editor, id })}
                    onChange={(entry) => setEditor({ ...editor, entry })}
                  />
                )}
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
