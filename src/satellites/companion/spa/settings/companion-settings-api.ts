import type { CompanionSettingsApi } from "@freeanima/frontend/shell-sdk/settings";
import {
  deleteModel,
  fetchMotionLibrary,
  renameModel,
  setActiveModel,
  uploadModel,
} from "../lib/api.ts";

function shellApi(): import("@freeanima/frontend/shell-sdk").SatelliteShellApi | undefined {
  return window.satelliteShell;
}

export function createCompanionSettingsApi(): CompanionSettingsApi {
  return {
    async getCompanionVisible() {
      const api = shellApi();
      if (!api?.getCompanionVisible) return true;
      return api.getCompanionVisible();
    },
    async setCompanionVisible(visible: boolean) {
      await shellApi()?.setCompanionVisible?.(visible);
    },
    async uploadModel(file: File) {
      await uploadModel(file);
    },
    async setActiveModel(id: string) {
      await setActiveModel(id);
    },
    async renameModel(id: string, name: string) {
      await renameModel(id, name);
    },
    async deleteModel(id: string) {
      await deleteModel(id);
    },
    async refreshMotionLibrary() {
      await fetchMotionLibrary();
    },
  };
}

export type { CompanionSettingsApi };
