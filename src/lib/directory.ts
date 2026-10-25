import type { Category } from "../data";

export function directoryCategories(categories: Category[], query = ""): Category[] {
  const normalized = query.trim().toLowerCase();
  return categories.filter((category) => category.visible !== false).map((category) => ({
    ...category,
    links: category.links.filter((link) => link.visible !== false && (!normalized || `${link.name} ${link.description} ${link.url}`.toLowerCase().includes(normalized))),
  })).filter((category) => !normalized || category.links.length > 0);
}

export function categoryAnchor(id: number): string {
  return `category-${id}`;
}
