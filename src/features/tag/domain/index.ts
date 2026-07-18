export type { TagRow, TagCreateInput, TagUpdateInput, TagSearchOpts } from "./types.ts";

export {
  listTags,
  searchTags,
  createTag,
  updateTag,
  deleteTag,
  setEntityTagIds,
} from "./tag-store.ts";

export { registerTagTools } from "./tools.ts";
