import type { CompanionSettingsApi } from "@freeanima/shell-sdk/settings";

import {
  deleteModel,
  renameModel,
  setActiveModel,
  uploadModel,
  fetchMotionLibrary,
} from "../lib/api.ts";

export function createCompanionSettingsApi(): CompanionSettingsApi {
  return {
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
