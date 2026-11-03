import type { Category } from "../data";

export function directoryCategories(categories: Category[], query = ""): Category[] {
  const normalized = query.trim().toLowerCase();
  const visibleCategories = categories.filter((category) => category.visible !== false);

  if (!normalized) {
    return visibleCategories.map((category) => {
      const allLinksVisible = category.links.every((link) => link.visible !== false);
      if (allLinksVisible) {
        return category;
      }
      return {
        ...category,
        links: category.links.filter((link) => link.visible !== false),
      };
    });
  }

  return visibleCategories
    .map((category) => ({
      ...category,
      links: category.links.filter(
        (link) =>
          link.visible !== false &&
          `${link.name} ${link.description} ${link.url}`.toLowerCase().includes(normalized),
      ),
    }))
    .filter((category) => category.links.length > 0);
}

export function categoryAnchor(id: number): string {
  return `category-${id}`;
}
