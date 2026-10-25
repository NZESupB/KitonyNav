import { Link, useLocation } from "react-router-dom";
import type { Category } from "../../data";
import { useUIStore } from "../../stores/ui-store";
import { categoryAnchor, directoryCategories } from "../../lib/directory";
import { ItemIcon } from "../icons/ItemIcon";

export function CategoryOutline({ categories, collapsed }: { categories: Category[]; collapsed: boolean }) {
  const activeId = useUIStore((state) => state.activeSectionId);
  const query = useUIStore((state) => state.searchQuery);
  const closeMenu = useUIStore((state) => state.setMobileMenuOpen);
  const location = useLocation();
  const items = directoryCategories(categories, query);
  return <nav className="sidebar-folders category-outline" aria-label="分类大纲">
    {items.map((category) => {
      const active = location.pathname === "/" && activeId === category.id;
      return <Link to={`/#${categoryAnchor(category.id)}`} key={category.id} className={`folder-row ${active ? "selected" : ""}`}
        onClick={() => closeMenu(false)} title={collapsed ? category.name : undefined} aria-label={`${category.name}，${category.links.length} 个链接`}
        aria-current={active ? "location" : undefined}>
        {active && <span className="nav-pill-active" />}
        <span className="sidebar-icon-slot"><ItemIcon icon={category.icon} iconKind={category.iconKind} iconUrl={category.iconUrl} size={18} /></span>
        {!collapsed && <span className="sidebar-text-slot outline-label"><span className="folder-text-content"><span className="folder-name">{category.name}</span><span className="folder-count">{category.links.length}</span></span></span>}
      </Link>;
    })}
    {items.length === 0 && !collapsed && <span className="outline-empty">没有匹配的分类</span>}
  </nav>;
}
