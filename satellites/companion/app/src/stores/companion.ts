import { create } from "zustand";
import {
  fetchConfig,
  getSettings,
  saveSettings,
  uploadModel as uploadModelApi,
} from "@/lib/api.ts";
import { emitConfigChanged, setPointerActive as setShellPointerActive } from "@/lib/tauri.ts";
import { isTauri } from "@/lib/tauri.ts";

type CompanionState = {
  loading: boolean;
  error: string | null;
  hubUrl: string;
  modelPath: string;
  instanceId: string;
  modelReady: boolean;
  modelLoading: boolean;
  hitTestFn: ((x: number, y: number) => boolean) | null;
  pointerActive: boolean;
  setHitTestFn: (fn: ((x: number, y: number) => boolean) | null) => void;
  setPointerActive: (active: boolean) => void;
  setModelReady: (ready: boolean) => void;
  setModelLoading: (loading: boolean) => void;
  init: () => Promise<void>;
  updateSettings: (patch: { hub_url?: string; model_path?: string }) => Promise<void>;
  uploadModel: (file: File) => Promise<void>;
  clearError: () => void;
};

export const useCompanionStore = create<CompanionState>((set) => ({
  loading: true,
  error: null,
  hubUrl: "http://127.0.0.1:2658",
  modelPath: "/models/default.vrm",
  instanceId: "",
  modelReady: false,
  modelLoading: false,
  hitTestFn: null,
  pointerActive: false,

  setHitTestFn(fn) {
    set({ hitTestFn: fn });
  },

  setPointerActive(active) {
    set({ pointerActive: active });
    if (isTauri()) {
      void setShellPointerActive(active);
    }
  },

  setModelReady(ready) {
    set({ modelReady: ready });
  },

  setModelLoading(loading) {
    set({ modelLoading: loading });
  },

  async init() {
    set({ loading: true, error: null });
    try {
      const cfg = await fetchConfig();
      const settings = await getSettings();
      const configuredPath = settings.model_path || cfg.model_path;
      const modelAvailable = settings.model_available ?? cfg.model_available;
      set({
        hubUrl: settings.hub_url || cfg.hub_url,
        modelPath: modelAvailable ? configuredPath : "",
        instanceId: cfg.instance_id,
        loading: false,
        modelReady: false,
        modelLoading: modelAvailable,
      });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  async updateSettings(patch) {
    const next = await saveSettings(patch);
    set({
      hubUrl: next.hub_url,
      modelPath: next.model_available ? next.model_path : "",
      modelReady: false,
      modelLoading: next.model_available,
    });
    await emitConfigChanged();
    if (patch.hub_url) {
      window.location.reload();
    }
  },

  async uploadModel(file) {
    const result = await uploadModelApi(file);
    set({
      modelPath: result.model_path,
      modelReady: false,
      modelLoading: true,
      error: null,
    });
    await emitConfigChanged();
  },

  clearError() {
    set({ error: null });
  },
}));
