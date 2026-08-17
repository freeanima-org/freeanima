import { useCallback, useEffect, useMemo, useState, type Key, type MouseEvent } from "react";
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
  llmEntryTitle,
  LLM_SYSTEM_PURPOSE_ROWS,
  newConnectionId,
  newSceneId,
  profilesDraftToPatch,
  providersDraftToPatch,
  purposeIdsForFocus,
  readProfileBindings,
  readProvidersDraft,
  readScenesUiDraft,
  readTimeoutDraft,
  sceneListSubtitle,
  scenesDraftFromProfilesAndBindings,
  scenesUiDraftToPatch,
  validateTimeoutDraft,
  type SceneBindingDraft,
} from "./llm-settings-draft.ts";
import {
  LlmConnectionEditorForm,
  LlmSceneEditorForm,
  LlmSystemScenesPanel,
} from "./llm-settings-forms.tsx";

type LlmTabId = "connections" | "custom" | "scenes";

type EditorState =
  | { kind: "connection"; mode: "create" | "edit"; id: string; entry: Record<string, unknown> }
  | { kind: "scene"; mode: "create" | "edit"; id: string; entry: Record<string, unknown> };

type Props = {
  llmConfig: Record<string, unknown>;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onError: (message: string) => void;
  onSaved: (section: string) => Promise<void>;
  /** 设置侧栏拆分：连接 / 对话场景 / 图片场景 / 语音场景 / 向量场景 / 全量 */
  panelFocus?: "connections" | "dialogue" | "image_gen" | "retrieval" | "voice" | "all";
};

function sceneBindingComplete(v: SceneBindingDraft | null | undefined): boolean {
  return Boolean(v?.connection?.trim() && v?.model?.trim());
}

export function LlmSettingsPanel({
  llmConfig,
  saving,
  onSavingChange,
  onError,
  onSaved,
  panelFocus = "all",
}: Props) {
  const useActionSheet = useActionSheetCapability();
  const initialTab: LlmTabId =
    panelFocus === "connections" ? "connections" : panelFocus === "all" ? "scenes" : "scenes";
  const [tab, setTab] = useState<LlmTabId>(initialTab);
  const [providersDraft, setProvidersDraft] = useState<Record<string, unknown>>({});
  const [profilesDraft, setProfilesDraft] = useState<Record<string, unknown>>({});
  const [defaultProfile, setDefaultProfile] = useState("chat");
  const [profileBindings, setProfileBindings] = useState<Record<string, string | null>>({});
  const [scenesDraft, setScenesDraft] = useState<Record<string, SceneBindingDraft | null>>({});
  const [editor, setEditor] = useState<EditorState | null>(null);

  useEffect(() => {
    setProvidersDraft(
      readProvidersDraft(llmConfig.providers as Record<string, unknown> | undefined),
    );
    setProfilesDraft(readLlmRecordDraft(llmConfig.profiles));
    setDefaultProfile(
      typeof llmConfig.default_profile === "string" ? llmConfig.default_profile : "chat",
    );
    setProfileBindings(readProfileBindings(llmConfig.profile_bindings));
    setScenesDraft(readScenesUiDraft(llmConfig));
  }, [llmConfig]);

  const providersRecord = useMemo(() => readHabitatConfigRecord(providersDraft), [providersDraft]);
  const profilesRecord = useMemo(() => readHabitatConfigRecord(profilesDraft), [profilesDraft]);

  const connectionIds = useMemo(() => Object.keys(providersRecord).toSorted(), [providersRecord]);
  const schemeIds = useMemo(() => Object.keys(profilesRecord).toSorted(), [profilesRecord]);

  const connectionLabels = useMemo(() => {
    const out: Record<string, string> = {};
    for (const id of connectionIds) {
      out[id] = llmEntryTitle(id, providersRecord[id]);
    }
    return out;
  }, [connectionIds, providersRecord]);

  const purposeFocus =
    panelFocus === "dialogue" ||
    panelFocus === "image_gen" ||
    panelFocus === "retrieval" ||
    panelFocus === "voice"
      ? panelFocus
      : "all";

  const onSceneChange = useCallback((purposeId: string, value: SceneBindingDraft | null) => {
    setScenesDraft((prev) => ({ ...prev, [purposeId]: value }));
  }, []);

  const saveScenesTab = useCallback(async () => {
    onSavingChange(true);
    onError("");
    try {
      const purposes = purposeIdsForFocus(purposeFocus);
      const requiredMain =
        purposeFocus === "image_gen"
          ? "image_generate"
          : purposeFocus === "retrieval"
            ? "embedding"
            : purposeFocus === "voice"
              ? "voice_generate"
              : "chat";
      if (purposes.includes(requiredMain) && !sceneBindingComplete(scenesDraft[requiredMain])) {
        onError("请为该能力的主场景选择连接与模型");
        return;
      }
      for (const purpose of purposes) {
        if (purpose === requiredMain) continue;
        const v = scenesDraft[purpose];
        if (v != null && !sceneBindingComplete(v)) {
          onError("单独指定的子场景须同时填写连接与模型，或改回「同主场景」");
          return;
        }
      }
      const scenes = scenesUiDraftToPatch(
        scenesDraft,
        (llmConfig.scenes as Record<string, unknown> | undefined) ?? {},
        purposes,
      );
      const patch: Record<string, unknown> = { scenes };
      if (purposeFocus === "dialogue" || purposeFocus === "all") {
        patch.default_scene = "chat";
        patch.default_profile = "chat";
      }
      await patchHabitatConfigSection("llm", patch);
      await onSaved("llm");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  }, [scenesDraft, purposeFocus, llmConfig.scenes, onError, onSaved, onSavingChange]);

  /** 静默校验（关闭时用）；不写 onError，避免拦关闭导致 Dialog FocusScope 崩。 */
  const isEditorValid = useCallback((): boolean => {
    if (!editor) return false;
    const id = editor.id.trim();
    if (!id) return false;
    if (editor.kind === "connection") {
      if (validateTimeoutDraft(readTimeoutDraft(editor.entry))) return false;
      if (editor.mode === "create" && connectionIds.includes(id)) return false;
    } else if (editor.mode === "create" && schemeIds.includes(id)) {
      return false;
    }
    return true;
  }, [editor, connectionIds, schemeIds]);

  const validateEditor = useCallback((): boolean => {
    if (!editor) return false;
    const id = editor.id.trim();
    if (!id) {
      onError(editor.kind === "connection" ? "连接 id 无效" : "方案 id 无效");
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
    } else if (editor.mode === "create" && schemeIds.includes(id)) {
      onError(`方案 id「${id}」已存在`);
      return false;
    }
    onError("");
    return true;
  }, [editor, connectionIds, schemeIds, onError]);

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
        const scenes = scenesDraftFromProfilesAndBindings({
          profiles: nextDraft,
          bindings: profileBindings,
          defaultProfile,
          existingScenes: (llmConfig.scenes as Record<string, unknown> | undefined) ?? {},
        });
        await patchHabitatConfigSection("llm", {
          profiles: profilesDraftToPatch(nextDraft),
          scenes,
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
    profileBindings,
    defaultProfile,
    llmConfig.scenes,
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

  const openCreateConnection = () => {
    setEditor({
      kind: "connection",
      mode: "create",
      id: newConnectionId(),
      entry: emptyConnectionEntry(),
    });
  };

  const openCreateScheme = () => {
    setEditor({
      kind: "scene",
      mode: "create",
      id: newSceneId(),
      entry: emptySceneEntry(),
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
      // providers 为条目级合并：缺键不会删，须显式 null
      await patchHabitatConfigSection("llm", {
        providers: { [id]: null },
      });
      await onSaved("llm.providers");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  };

  const deleteScheme = async (id: string) => {
    const label = llmEntryTitle(id, profilesRecord[id]);
    const ok = await showConfirm({
      title: "删除方案？",
      description: `将移除方案「${label}」。`,
      confirmLabel: "删除",
      variant: "error",
    });
    if (!ok) return;
    const next = { ...profilesRecord };
    delete next[id];
    setProfilesDraft(next);
    const nextBindings = { ...profileBindings };
    for (const [purpose, bound] of Object.entries(nextBindings)) {
      if (bound === id) nextBindings[purpose] = null;
    }
    setProfileBindings(nextBindings);
    onSavingChange(true);
    onError("");
    try {
      const scenes = scenesDraftFromProfilesAndBindings({
        profiles: next,
        bindings: nextBindings,
        defaultProfile,
        existingScenes: (llmConfig.scenes as Record<string, unknown> | undefined) ?? {},
      });
      // 去掉已删除方案 id 对应的自定义 scene（系统用途仍由 bindings 合成）
      if (scenes[id] && !LLM_SYSTEM_PURPOSE_ROWS.some((r) => r.id === id)) {
        delete scenes[id];
      }
      await patchHabitatConfigSection("llm", {
        profiles: { [id]: null },
        profile_bindings: nextBindings,
        scenes: {
          ...scenes,
          // 自定义方案同名 scene：显式删除
          ...(LLM_SYSTEM_PURPOSE_ROWS.some((r) => r.id === id) ? {} : { [id]: null }),
        },
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
          ? "新建方案"
          : "编辑方案"
        : "";

  useEffect(() => {
    if (panelFocus === "connections") setTab("connections");
    else if (
      panelFocus === "dialogue" ||
      panelFocus === "image_gen" ||
      panelFocus === "retrieval" ||
      panelFocus === "voice"
    ) {
      setTab("scenes");
    }
  }, [panelFocus]);

  const showScenes =
    panelFocus === "all" ||
    panelFocus === "dialogue" ||
    panelFocus === "image_gen" ||
    panelFocus === "retrieval" ||
    panelFocus === "voice";
  const showCustom = panelFocus === "all";
  const showConnections = panelFocus === "all" || panelFocus === "connections";

  const tabCount = Number(showScenes) + Number(showCustom) + Number(showConnections);
  const useTabs = tabCount > 1;

  const scenesPanel = (
    <div className="space-y-4">
      <LlmSystemScenesPanel
        scenesDraft={scenesDraft}
        onSceneChange={onSceneChange}
        connectionIds={connectionIds}
        connectionLabels={connectionLabels}
        providersById={providersRecord}
        purposeFocus={purposeFocus}
      />
      <Button type="button" isDisabled={saving} onClick={() => void saveScenesTab()}>
        保存场景
      </Button>
    </div>
  );

  const customPanel = (
    <div className="space-y-4">
      {schemeIds.length === 0 ? (
        <EmptyState
          message="还没有方案"
          action={
            <Button type="button" size="sm" onClick={openCreateScheme}>
              新建方案
            </Button>
          }
        />
      ) : (
        <ul className="space-y-1">
          {schemeIds.map((id) => {
            const entry = profilesRecord[id] ?? {};
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
                  <p className="truncate text-sm font-medium">{llmEntryTitle(id, entry)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {sceneListSubtitle(entry)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive shrink-0"
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    void deleteScheme(id);
                  }}
                >
                  删除
                </Button>
              </ListRow>
            );
          })}
        </ul>
      )}
      {schemeIds.length > 0 ? (
        <Button type="button" size="sm" variant="outline" onClick={openCreateScheme}>
          新建方案
        </Button>
      ) : null}
    </div>
  );

  const connectionsPanel = (
    <div className="space-y-4">
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
        <ul className="space-y-1">
          {connectionIds.map((id) => {
            const entry = providersRecord[id] ?? {};
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
      )}
      {connectionIds.length > 0 ? (
        <Button type="button" size="sm" variant="outline" onClick={openCreateConnection}>
          新建连接
        </Button>
      ) : null}
    </div>
  );

  return (
    <Card className="bg-muted py-0">
      <CardContent className="gap-4 py-4">
        {useTabs ? (
          <Tabs
            selectedKey={tab}
            onSelectionChange={(key: Key) => setTab(String(key) as LlmTabId)}
            className="w-full"
          >
            <TabsList variant="default" className="w-full justify-start">
              {showScenes ? <TabsTrigger id="scenes">场景</TabsTrigger> : null}
              {showCustom ? <TabsTrigger id="custom">自定义</TabsTrigger> : null}
              {showConnections ? <TabsTrigger id="connections">连接</TabsTrigger> : null}
            </TabsList>

            {showScenes ? (
              <TabsContent id="scenes" className="space-y-4 pt-2">
                {scenesPanel}
              </TabsContent>
            ) : null}
            {showCustom ? (
              <TabsContent id="custom" className="space-y-4 pt-2">
                {customPanel}
              </TabsContent>
            ) : null}
            {showConnections ? (
              <TabsContent id="connections" className="space-y-4 pt-2">
                {connectionsPanel}
              </TabsContent>
            ) : null}
          </Tabs>
        ) : showScenes ? (
          scenesPanel
        ) : showCustom ? (
          customPanel
        ) : showConnections ? (
          connectionsPanel
        ) : null}

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
                    entry={editor.entry}
                    onChange={(entry) => setEditor({ ...editor, entry })}
                    testDisabled={saving}
                  />
                ) : (
                  <LlmSceneEditorForm
                    sceneId={editor.id}
                    entry={editor.entry}
                    connectionIds={connectionIds}
                    connectionLabels={connectionLabels}
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
