import { create } from "zustand";
import {
  fetchCompanionConfig,
  resetSidecarOriginCache,
  saveSettings,
  uploadModel as uploadModelApi,
  type CompanionConfig,
} from "@/lib/api.ts";
import { emitConfigChanged, setPointerActive as setShellPointerActive } from "@/lib/tauri.ts";
import { isTauri } from "@/lib/tauri.ts";
import type { CompanionBehavior, ModelEntry, MotionSlotsConfig } from "@shared/companion-schema.ts";
import type { MotionLibraryEntry } from "@shared/constants.ts";
import { DEFAULT_BEHAVIOR } from "@shared/companion-schema.ts";

type SettingsTabId = "general" | "behavior" | "models" | "slots" | "library";

type CompanionState = {
  loading: boolean;
  error: string | null;
  settingsTab: SettingsTabId;
  settingsOpen: boolean;
  hubUrl: string;
  modelPath: string;
  instanceId: string;
  sapConnected: boolean;
  characterReady: boolean;
  modelLoading: boolean;
  configRevision: number;
  activeModelId: string;
  models: ModelEntry[];
  motionLibrary: MotionLibraryEntry[];
  motionSlots: MotionSlotsConfig;
  behavior: CompanionBehavior;
  hitTestFn: ((x: number, y: number) => boolean) | null;
  pointerActive: boolean;
  backendRef: { current: import("@/renderer/VrmBackend.ts").VrmBackend | null };
  setHitTestFn: (fn: ((x: number, y: number) => boolean) | null) => void;
  setPointerActive: (active: boolean) => void;
  setCharacterReady: (ready: boolean) => void;
  setModelLoading: (loading: boolean) => void;
  setBackend: (backend: import("@/renderer/VrmBackend.ts").VrmBackend | null) => void;
  applyConfig: (cfg: CompanionConfig) => void;
  init: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  updateSettings: (patch: {
    hub_url?: string;
    behavior?: Partial<CompanionBehavior>;
    motion_slots?: MotionSlotsConfig;
  }) => Promise<void>;
  uploadModel: (file: File) => Promise<void>;
  clearError: () => void;
  setSettingsTab: (tab: SettingsTabId) => void;
  setSettingsOpen: (open: boolean) => void;
};

function applyConfigToState(cfg: CompanionConfig, prev?: CompanionState): Partial<CompanionState> {
  return {
    hubUrl: cfg.hub_url,
    modelPath: cfg.model_available ? cfg.model_path : "",
    instanceId: cfg.instance_id,
    sapConnected: cfg.sap_connected,
    activeModelId: cfg.active_model_id,
    models: cfg.models,
    motionLibrary: cfg.motion_library,
    motionSlots: cfg.motion_slots,
    behavior: cfg.behavior ?? DEFAULT_BEHAVIOR,
    modelLoading:
      cfg.model_available && !(prev?.characterReady && prev.modelPath === cfg.model_path),
    configRevision: (prev?.configRevision ?? 0) + 1,
  };
}

export const useCompanionStore = create<CompanionState>((set, get) => ({
  loading: true,
  error: null,
  settingsTab: "general",
  settingsOpen: false,
  hubUrl: "http://127.0.0.1:2658",
  modelPath: "",
  instanceId: "",
  sapConnected: false,
  characterReady: false,
  modelLoading: false,
  configRevision: 0,
  activeModelId: "",
  models: [],
  motionLibrary: [],
  motionSlots: {} as MotionSlotsConfig,
  behavior: { ...DEFAULT_BEHAVIOR },
  hitTestFn: null,
  pointerActive: false,
  backendRef: { current: null },

  setHitTestFn(fn) {
    set({ hitTestFn: fn });
  },

  setPointerActive(active) {
    set({ pointerActive: active });
    if (isTauri()) {
      void setShellPointerActive(active);
    }
  },

  setCharacterReady(ready) {
    set({ characterReady: ready, modelLoading: ready ? false : get().modelLoading });
  },

  setModelLoading(loading) {
    set({ modelLoading: loading });
  },

  setBackend(backend) {
    get().backendRef.current = backend;
  },

  applyConfig(cfg) {
    const prev = get();
    const hubChanged = prev.hubUrl !== cfg.hub_url;
    if (hubChanged) {
      resetSidecarOriginCache();
    }
    const modelChanged = prev.modelPath !== cfg.model_path;
    set({
      ...applyConfigToState(cfg, prev),
      loading: false,
      characterReady: modelChanged ? false : prev.characterReady,
    });
  },

  async init() {
    set({ loading: true, error: null });
    try {
      const cfg = await fetchCompanionConfig();
      get().applyConfig(cfg);
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  async refreshConfig() {
    try {
      const cfg = await fetchCompanionConfig();
      get().applyConfig(cfg);
      const backend = get().backendRef.current;
      if (backend && get().characterReady) {
        await backend.reloadAnimations({
          library: cfg.motion_library,
          slots: cfg.motion_slots,
        });
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  async updateSettings(patch) {
    const next = await saveSettings(patch);
    get().applyConfig(next);
    await emitConfigChanged();
    await get().refreshConfig();
  },

  async uploadModel(file) {
    const result = await uploadModelApi(file);
    get().applyConfig(result.config);
    set({ characterReady: false, modelLoading: true, error: null });
    await emitConfigChanged();
  },

  clearError() {
    set({ error: null });
  },

  setSettingsTab(tab) {
    set({ settingsTab: tab });
  },

  setSettingsOpen(open) {
    set({ settingsOpen: open });
  },
}));

/** @deprecated 使用 characterReady */
export function useModelReady(): boolean {
  return useCompanionStore((s) => s.characterReady);
}
