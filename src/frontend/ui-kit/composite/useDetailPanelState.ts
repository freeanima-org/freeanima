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

export type UseDetailPanelStateOptions<T> = {
  layoutMode: ThreeColumnLayoutMode;
  cloneItem: (item: T) => T;
  isDirty: (current: T, baseline: T) => boolean;
  isEqual: (a: T, b: T) => boolean;
  persistItem: (item: T) => Promise<T>;
  autoSaveDebounceMs?: number;
  /** compact 下是否自动打开详情 Sheet（如移动任务弹窗打开时可设为 false） */
  compactSheetEnabled?: boolean;
  onSaved?: (saved: T) => void;
  onPersistError?: (error: unknown) => void;
};

export type UseDetailPanelStateResult<T> = {
  item: T | null;
  setItem: Dispatch<SetStateAction<T | null>>;
  baseline: T | null;
  detailOpen: boolean;
  saveStatus: DetailSaveStatus;
  saving: boolean;
  openDetail: (item: T) => void;
  closeDetail: (opts?: { discard?: boolean }) => void;
  closeDetailSheet: () => void;
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
  onSaved,
  onPersistError,
}: UseDetailPanelStateOptions<T>): UseDetailPanelStateResult<T> {
  const [item, setItem] = useState<T | null>(null);
  const [baseline, setBaseline] = useState<T | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<DetailSaveStatus>("idle");
  const discardRef = useRef(false);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDetail = useCallback(() => {
    setItem(null);
    setBaseline(null);
    setDetailOpen(false);
    setSaveStatus("idle");
  }, []);

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
          setItem(null);
          setBaseline(null);
          setDetailOpen(false);
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
            // 离线 create flush 后 synced.id 可能已从 temp 变为 server id
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
      baseline,
      cloneItem,
      isDirty,
      isEqual,
      item,
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
    [cloneItem, flushSave, layoutMode],
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
    };
  }, []);

  useEffect(() => {
    if (layoutMode !== "compact") {
      setDetailOpen(false);
    } else if (item && compactSheetEnabled) {
      setDetailOpen(true);
    }
  }, [compactSheetEnabled, item?.id, layoutMode]);

  return {
    item,
    setItem,
    baseline,
    detailOpen,
    saveStatus,
    saving,
    openDetail,
    closeDetail,
    closeDetailSheet,
    handleDetailOpenChange,
    flushSave,
    resetDetail,
    applySavedItem,
  };
}
