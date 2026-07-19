export type { TagRow, TagCreateInput, TagUpdateInput, TagSearchOpts } from "./types.ts";

export {
  listTags,
  searchTags,
  findTagByTitle,
  ensureTagsByTitles,
  createTag,
  updateTag,
  deleteTag,
  setEntityTagIds,
} from "./tag-store.ts";

export { registerTagTools } from "./tools.ts";
