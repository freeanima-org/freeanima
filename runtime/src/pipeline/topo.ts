import type { PipelineNodeDefinition } from "./types.ts";

/** 拓扑排序；环则抛错 */
export function topologicalSort(nodes: PipelineNodeDefinition[]): PipelineNodeDefinition[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const stack = new Set<string>();
  const order: PipelineNodeDefinition[] = [];

  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (stack.has(id)) {
      throw new Error(`Pipeline cycle detected at node: ${id}`);
    }
    const node = byId.get(id);
    if (!node) throw new Error(`Unknown pipeline node: ${id}`);

    stack.add(id);
    for (const dep of node.dependsOn ?? []) {
      if (!byId.has(dep)) throw new Error(`Unknown dependency ${dep} for node ${id}`);
      visit(dep);
    }
    stack.delete(id);
    visited.add(id);
    order.push(node);
  };

  for (const node of nodes) {
    visit(node.id);
  }
  return order;
}
