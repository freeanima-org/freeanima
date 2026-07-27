import { mergeDraftAfterSave } from "../lib/merge-draft-after-save.ts";
import type { ThreeColumnLayoutMode } from "../layout/three-column-mode.ts";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { DetailSaveStatus } from "./DetailPanelShell.tsx";
import {
  DETAIL_EDIT_HISTORY_KEY,
  clearDetailEditChrome,
  enterDetailEditChrome,
  exitDetailEditChrome,
  historyStateHasDetailEdit,
} from "./detail-edit-chrome.ts";

export { DETAIL_EDIT_HISTORY_KEY } from "./detail-edit-chrome.ts";

export type UseDetailPanelStateOptions<T> = {
  layoutMode: ThreeColumnLayoutMode;
  cloneItem: (item: T) => T;
  isDirty: (current: T, baseline: T) => boolean;
  isEqual: (a: T, b: T) => boolean;
  persistItem: (item: T) => Promise<T>;
  autoSaveDebounceMs?: number;
  /** compact 下是否自动打开详情 Sheet（如移动任务弹窗打开时可设为 false） */
  compactSheetEnabled?: boolean;
  /** compact 全屏编辑时隐藏壳底栏；由 App 注入 portal-sdk setCompactImmersive */
  setCompactImmersive?: (immersive: boolean) => void;
  onSaved?: (saved: T) => void;
  onPersistError?: (error: unknown) => void;
};

export type UseDetailPanelStateResult<T> = {
  item: T | null;
  setItem: Dispatch<SetStateAction<T | null>>;
  baseline: T | null;
  detailOpen: boolean;
  /** compact：标题/描述激活后的全屏编辑页 */
  detailEditMode: boolean;
  saveStatus: DetailSaveStatus;
  saving: boolean;
  openDetail: (item: T) => void;
  closeDetail: (opts?: { discard?: boolean }) => void;
  closeDetailSheet: () => void;
  enterDetailEdit: () => void;
  exitDetailEdit: () => void;
  handleDetailOpenChange: (open: boolean) => void;
  flushSave: () => Promise<boolean>;
  resetDetail: () => void;
  applySavedItem: (saved: T) => void;
};

export function useDetailPanelState<T extends { id: number }>({
  layoutMode,
  cloneItem,
  isDirty,
  isEqual,
  persistItem,
  autoSaveDebounceMs = 600,
  compactSheetEnabled = true,
  setCompactImmersive,
  onSaved,
  onPersistError,
}: UseDetailPanelStateOptions<T>): UseDetailPanelStateResult<T> {
  const [item, setItem] = useState<T | null>(null);
  const [baseline, setBaseline] = useState<T | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<DetailSaveStatus>("idle");
  const discardRef = useRef(false);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editHistoryPushedRef = useRef(false);
  const detailEditModeRef = useRef(false);
  const itemRef = useRef<T | null>(null);
  const setCompactImmersiveRef = useRef(setCompactImmersive);
  setCompactImmersiveRef.current = setCompactImmersive;
  itemRef.current = item;
  detailEditModeRef.current = detailEditMode;

  const applyChrome = useCallback(
    (chrome: { detailEditMode: boolean; detailOpen: boolean; immersive: boolean }) => {
      detailEditModeRef.current = chrome.detailEditMode;
      setDetailEditMode(chrome.detailEditMode);
      setDetailOpen(chrome.detailOpen);
      setCompactImmersiveRef.current?.(chrome.immersive);
    },
    [],
  );

  const leaveEditMode = useCallback(
    (opts?: { reopenPeek?: boolean; syncHistory?: boolean }) => {
      const wasEditing = detailEditModeRef.current;
      if (!wasEditing && !editHistoryPushedRef.current) {
        setCompactImmersiveRef.current?.(false);
        return;
      }
      applyChrome(
        exitDetailEditChrome({
          layoutMode,
          hasItem: itemRef.current != null,
          compactSheetEnabled,
          reopenPeek: opts?.reopenPeek === true,
        }),
      );
      if (
        opts?.syncHistory !== false &&
        editHistoryPushedRef.current &&
        typeof window !== "undefined" &&
        historyStateHasDetailEdit(window.history.state)
      ) {
        editHistoryPushedRef.current = false;
        window.history.back();
        return;
      }
      editHistoryPushedRef.current = false;
    },
    [applyChrome, compactSheetEnabled, layoutMode],
  );

  const clearDetail = useCallback(
    (opts?: { syncHistory?: boolean }) => {
      leaveEditMode({ reopenPeek: false, syncHistory: opts?.syncHistory !== false });
      applyChrome(clearDetailEditChrome());
      setItem(null);
      setBaseline(null);
      setSaveStatus("idle");
    },
    [applyChrome, leaveEditMode],
  );

  const markSaved = useCallback(() => {
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    setSaveStatus("saved");
    saveStatusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  }, []);

  const persist = useCallback(
    async (opts?: { closeAfter?: boolean }): Promise<boolean> => {
      const current = item;
      const currentBaseline = baseline;
      if (!current || !currentBaseline || !isDirty(current, currentBaseline)) return true;
      if (saving) return false;
      const savingSnapshot = cloneItem(current);
      setSaving(true);
      setSaveStatus("saving");
      try {
        const saved = await persistItem(savingSnapshot);
        discardRef.current = false;
        const synced = cloneItem(saved);
        if (opts?.closeAfter) {
          leaveEditMode({ reopenPeek: false, syncHistory: true });
          applyChrome(clearDetailEditChrome());
          setItem(null);
          setBaseline(null);
        } else {
          setBaseline(synced);
          setItem((draft) => {
            if (!draft) return synced;
            const merged = mergeDraftAfterSave({
              current: draft,
              savingSnapshot,
              synced,
              isEqual,
            }).draft;
            return merged.id === synced.id ? merged : { ...merged, id: synced.id };
          });
        }
        onSaved?.(saved);
        markSaved();
        return true;
      } catch (err) {
        onPersistError?.(err);
        setSaveStatus("error");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [
      applyChrome,
      baseline,
      cloneItem,
      isDirty,
      isEqual,
      item,
      leaveEditMode,
      markSaved,
      onPersistError,
      onSaved,
      persistItem,
      saving,
    ],
  );

  const flushSave = useCallback(async (): Promise<boolean> => {
    return persist();
  }, [persist]);

  const openDetail = useCallback(
    (next: T) => {
      void (async () => {
        await flushSave();
        leaveEditMode({ reopenPeek: false, syncHistory: true });
        setItem((prev) => {
          if (prev?.id === next.id) return prev;
          const copy = cloneItem(next);
          setBaseline(copy);
          return copy;
        });
        setSaveStatus("idle");
        if (layoutMode === "compact") setDetailOpen(true);
      })();
    },
    [cloneItem, flushSave, layoutMode, leaveEditMode],
  );

  const closeDetail = useCallback(
    (opts?: { discard?: boolean }) => {
      if (opts?.discard) discardRef.current = true;
      clearDetail();
    },
    [clearDetail],
  );

  const closeDetailSheet = useCallback(() => {
    setDetailOpen(false);
  }, []);

  const enterDetailEdit = useCallback(() => {
    const chrome = enterDetailEditChrome(layoutMode, itemRef.current != null);
    if (!chrome) return;
    if (detailEditModeRef.current) return;
    applyChrome(chrome);
    if (typeof window !== "undefined" && !historyStateHasDetailEdit(window.history.state)) {
      const prev =
        window.history.state && typeof window.history.state === "object"
          ? window.history.state
          : {};
      window.history.pushState({ ...prev, [DETAIL_EDIT_HISTORY_KEY]: true }, "");
      editHistoryPushedRef.current = true;
    }
  }, [applyChrome, layoutMode]);

  /** 退出全屏编辑 → 列表（不恢复 peek 展示态） */
  const exitDetailEdit = useCallback(() => {
    void (async () => {
      await flushSave();
      clearDetail({ syncHistory: true });
    })();
  }, [clearDetail, flushSave]);

  const handleDetailOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setDetailOpen(true);
        return;
      }
      if (discardRef.current) {
        discardRef.current = false;
        clearDetail();
        return;
      }
      void (async () => {
        const dirty = item != null && baseline != null && isDirty(item, baseline);
        if (dirty) {
          const ok = await persist({ closeAfter: true });
          if (!ok) return;
          return;
        }
        clearDetail();
      })();
    },
    [baseline, clearDetail, isDirty, item, persist],
  );

  const resetDetail = useCallback(() => {
    clearDetail();
  }, [clearDetail]);

  const applySavedItem = useCallback(
    (saved: T) => {
      const synced = cloneItem(saved);
      setItem((prev) => {
        if (!prev) return prev;
        if (prev.id === saved.id || prev.id < 0) return synced;
        return prev;
      });
      setBaseline((prev) => {
        if (!prev) return prev;
        if (prev.id === saved.id || prev.id < 0) return synced;
        return prev;
      });
    },
    [cloneItem],
  );

  useEffect(() => {
    if (!item || !baseline || !isDirty(item, baseline)) return;
    if (saving) return;
    const timer = setTimeout(() => void persist(), autoSaveDebounceMs);
    return () => clearTimeout(timer);
  }, [autoSaveDebounceMs, baseline, isDirty, item, persist, saving]);

  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      setCompactImmersiveRef.current?.(false);
    };
  }, []);

  useEffect(() => {
    if (layoutMode !== "compact") {
      leaveEditMode({ reopenPeek: false, syncHistory: true });
      setDetailOpen(false);
    } else if (item && compactSheetEnabled && !detailEditModeRef.current) {
      setDetailOpen(true);
    }
  }, [compactSheetEnabled, item?.id, layoutMode, leaveEditMode]);

  const flushSaveRef = useRef(flushSave);
  flushSaveRef.current = flushSave;
  const clearDetailRef = useRef(clearDetail);
  clearDetailRef.current = clearDetail;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => {
      if (!detailEditModeRef.current) return;
      editHistoryPushedRef.current = false;
      void (async () => {
        await flushSaveRef.current();
        clearDetailRef.current({ syncHistory: false });
      })();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return {
    item,
    setItem,
    baseline,
    detailOpen,
    detailEditMode,
    saveStatus,
    saving,
    openDetail,
    closeDetail,
    closeDetailSheet,
    enterDetailEdit,
    exitDetailEdit,
    handleDetailOpenChange,
    flushSave,
    resetDetail,
    applySavedItem,
  };
}
