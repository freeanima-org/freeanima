import { create } from "zustand";
import {
  fetchOverlayCompanionConfig,
  loadHabitatCompanionSettingsConfig,
  saveSettings,
  uploadModel as uploadModelApi,
  type CompanionConfig,
} from "../lib/api.ts";
import {
  emitConfigChanged,
  isCompanionOverlay,
  setPointerActive as setShellPointerActive,
} from "../lib/portal-shell.ts";
import type {
  CompanionBehavior,
  ModelEntry,
  MotionSlotsConfig,
} from "@freeanima/features/companion/shared/companion-schema.ts";
import type { MotionLibraryEntry } from "@freeanima/features/companion/shared/constants.ts";
import { DEFAULT_BEHAVIOR } from "@freeanima/features/companion/shared/companion-schema.ts";
import type { VrmBackend } from "../renderer/VrmBackend.ts";

type SettingsTabId = "behavior" | "models" | "slots" | "library";

type CompanionState = {
  loading: boolean;
  error: string | null;
  settingsTab: SettingsTabId;
  settingsOpen: boolean;
  habitatUrl: string;
  modelPath: string;
  instanceId: string;
  sapConnected: boolean;
  fbxImportAvailable: boolean;
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
  backendRef: { current: VrmBackend | null };
  runtimeBubble: { id: string; text: string } | null;
  runtimeBubblePending: number;
  setHitTestFn: (fn: ((x: number, y: number) => boolean) | null) => void;
  setPointerActive: (active: boolean) => void;
  setCharacterReady: (ready: boolean) => void;
  setModelLoading: (loading: boolean) => void;
  setBackend: (backend: VrmBackend | null) => void;
  setRuntimeBubble: (current: { id: string; text: string } | null, pending: number) => void;
  applyConfig: (cfg: CompanionConfig) => void;
  init: () => Promise<void>;
  initHabitatSettings: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  updateSettings: (patch: {
    behavior?: Partial<CompanionBehavior>;
    motion_slots?: MotionSlotsConfig;
  }) => Promise<void>;
  uploadModel: (file: File) => Promise<void>;
  clearError: () => void;
  setSettingsTab: (tab: SettingsTabId) => void;
  setSettingsOpen: (open: boolean) => void;
};

function visualConfigChanged(cfg: CompanionConfig, prev?: CompanionState): boolean {
  if (!prev) return true;
  const modelPath = cfg.model_available ? cfg.model_path : "";
  if (prev.modelPath !== modelPath) return true;
  if (prev.activeModelId !== cfg.active_model_id) return true;
  if (JSON.stringify(prev.motionSlots) !== JSON.stringify(cfg.motion_slots)) return true;
  if (JSON.stringify(prev.motionLibrary) !== JSON.stringify(cfg.motion_library)) return true;
  return false;
}

function applyConfigToState(cfg: CompanionConfig, prev?: CompanionState): Partial<CompanionState> {
  const modelPath = cfg.model_available ? cfg.model_path : "";
  const bumpRevision = visualConfigChanged(cfg, prev);
  const runtimeFields = isCompanionOverlay()
    ? {}
    : {
        instanceId: cfg.instance_id,
        sapConnected: cfg.remote_tools_connected,
      };
  return {
    habitatUrl: cfg.habitat_url,
    modelPath,
    ...runtimeFields,
    fbxImportAvailable: cfg.fbx_import_available,
    activeModelId: cfg.active_model_id,
    models: cfg.models,
    motionLibrary: cfg.motion_library,
    motionSlots: cfg.motion_slots,
    behavior: cfg.behavior ?? DEFAULT_BEHAVIOR,
    modelLoading: cfg.model_available && !(prev?.characterReady && prev.modelPath === modelPath),
    configRevision: bumpRevision ? (prev?.configRevision ?? 0) + 1 : (prev?.configRevision ?? 0),
  };
}

export const useCompanionStore = create<CompanionState>((set, get) => ({
  loading: true,
  error: null,
  settingsTab: "behavior",
  settingsOpen: false,
  habitatUrl: "http://127.0.0.1:2658",
  modelPath: "",
  instanceId: "",
  sapConnected: false,
  fbxImportAvailable: false,
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
  runtimeBubble: null,
  runtimeBubblePending: 0,

  setHitTestFn(fn) {
    set({ hitTestFn: fn });
  },

  setPointerActive(active) {
    set({ pointerActive: active });
    if (isCompanionOverlay()) {
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

  setRuntimeBubble(current, pending) {
    set({ runtimeBubble: current, runtimeBubblePending: pending });
  },

  applyConfig(cfg) {
    const prev = get();
    const modelPath = cfg.model_available ? cfg.model_path : "";
    const modelChanged = prev.modelPath !== modelPath;
    set({
      ...applyConfigToState(cfg, prev),
      loading: false,
      characterReady: modelChanged ? false : prev.characterReady,
    });
  },

  async init() {
    set({ loading: true, error: null });
    try {
      const cfg = await fetchOverlayCompanionConfig();
      get().applyConfig(cfg);
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  async initHabitatSettings() {
    set({ loading: true, error: null });
    try {
      const cfg = await loadHabitatCompanionSettingsConfig();
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
      const cfg = isCompanionOverlay()
        ? await fetchOverlayCompanionConfig()
        : await loadHabitatCompanionSettingsConfig();
      get().applyConfig(cfg);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  async updateSettings(patch) {
    const next = await saveSettings(patch);
    get().applyConfig(next);
    await get().refreshConfig();
    await emitConfigChanged();
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
