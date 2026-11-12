import type { CategoryNode } from "./category-tree";

/** Restore identifiers against the current tree; cached children/form keys are never trusted. */
export function resolveCategoryPath(tree: CategoryNode[], saved: unknown): CategoryNode[] {
  if (!Array.isArray(saved)) return [];
  const path: CategoryNode[] = [];
  let level = tree;
  for (const entry of saved) {
    if (!entry || typeof entry !== "object") break;
    const item = entry as { key?: unknown; slug?: unknown };
    const node = level.find(n => typeof item.key === "string" && n.key === item.key)
      ?? level.find(n => typeof item.slug === "string" && n.slug === item.slug);
    if (!node) break;
    path.push(node); level = node.children ?? [];
  }
  return path;
}
