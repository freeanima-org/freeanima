import {
  handleDiaryList,
  handleDiaryCreate,
  handleDiaryAppend,
  handleDiaryPatch,
  handleDiaryDelete,
  handleDiaryGet,
  handleDiarySearch,
} from "./hub/rpc.ts";

/** Diary feature plugin — registered by platform at boot. */
export const diaryPlugin = {
  id: "diary",
  shell: {
    routes: [{ path: "/diary", featureId: "diary", navLabel: "Diary" }],
  },
  hub: {
    rpc: {
      "diary.list": handleDiaryList,
      "diary.create": handleDiaryCreate,
      "diary.append": handleDiaryAppend,
      "diary.patch": handleDiaryPatch,
      "diary.delete": handleDiaryDelete,
      "diary.get": handleDiaryGet,
      "diary.search": handleDiarySearch,
    },
  },
} as const;
