import { semanticMemory } from "../semantic-memory.ts";

export type SemanticMemoryRow = typeof semanticMemory.$inferSelect;

export type SemanticFtsHit = SemanticMemoryRow & { rank: number };
