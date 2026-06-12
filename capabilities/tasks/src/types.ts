export type {
  TaskRow,
  TaskStatus,
  TaskPriority,
  TaskCreateInput,
  TaskUpdateInput,
  TaskListOpts,
} from "@freeanima/storage-repos";

export type FridgeBridge = {
  setMagnet(module: string, id: string, value: string, ttl?: number): Promise<void>;
  deleteMagnet(module: string, id: string): Promise<void>;
};
