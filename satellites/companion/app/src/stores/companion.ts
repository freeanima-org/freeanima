import { create } from "zustand";
import {
  fetchConfig,
  getSettings,
  saveSettings,
  uploadModel as uploadModelApi,
} from "@/lib/api.ts";

type CompanionState = {
  loading: boolean;
  error: string | null;
  hubUrl: string;
  modelPath: string;
  instanceId: string;
  settingsOpen: boolean;
  modelReady: boolean;
  hitTestFn: ((x: number, y: number) => boolean) | null;
  setHitTestFn: (fn: ((x: number, y: number) => boolean) | null) => void;
  setModelReady: (ready: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
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
  settingsOpen: false,
  modelReady: false,
  hitTestFn: null,

  setHitTestFn(fn) {
    set({ hitTestFn: fn });
  },

  setModelReady(ready) {
    set({ modelReady: ready });
  },

  setSettingsOpen(open) {
    set({ settingsOpen: open });
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
        settingsOpen: !modelAvailable,
      });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
        settingsOpen: true,
      });
    }
  },

  async updateSettings(patch) {
    const next = await saveSettings(patch);
    set({
      hubUrl: next.hub_url,
      modelPath: next.model_available ? next.model_path : "",
      modelReady: false,
      settingsOpen: !next.model_available,
    });
    if (patch.hub_url) {
      window.location.reload();
    }
  },

  async uploadModel(file) {
    const result = await uploadModelApi(file);
    set({ modelPath: result.model_path, modelReady: false, settingsOpen: false, error: null });
  },

  clearError() {
    set({ error: null });
  },
}));
