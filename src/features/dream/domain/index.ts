/** Dream store — domain remains in capabilities-memory until fully colocated. */
export type {
  DreamEntryRow,
  DreamEntryCreateInput,
  DreamEntryListOpts,
  DreamStoreContext,
} from "@freeanima/capabilities/memory/dream-store";
export {
  countDreamEntries,
  createDreamEntry,
  getDreamEntry,
  getDreamEntryByDay,
  getLatestDreamEntry,
  listDreamEntries,
  resolveDreamWorldId,
} from "@freeanima/capabilities/memory/dream-store";
