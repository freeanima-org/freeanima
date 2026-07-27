import type { CompanionSettingsApi } from "@freeanima/client/portal-sdk/settings";
import {
  deleteModel,
  fetchMotionLibrary,
  renameModel,
  setActiveModel,
  uploadModel,
} from "../lib/api.ts";

export function createCompanionSettingsApi(): CompanionSettingsApi {
  return {
    async uploadModel(file: File) {
      await uploadModel(file);
    },
    async setActiveModel(objectFileId: number) {
      await setActiveModel(objectFileId);
    },
    async renameModel(objectFileId: number, name: string) {
      await renameModel(objectFileId, name);
    },
    async deleteModel(objectFileId: number) {
      await deleteModel(objectFileId);
    },
    async refreshMotionLibrary() {
      await fetchMotionLibrary();
    },
  };
}

export type { CompanionSettingsApi };
