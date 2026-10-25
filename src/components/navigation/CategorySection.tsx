import type { Category } from "../../data";
import type { ConnectivityResult } from "../../lib/connectivity";
import { categoryAnchor } from "../../lib/directory";
import { ItemIcon } from "../icons/ItemIcon";
import { LinkItemCard } from "./LinkItemCard";

export function CategorySection({ category, connectivity }: { category: Category; connectivity: Record<number, ConnectivityResult | undefined> }) {
  const id = categoryAnchor(category.id);
  return <section id={id} className="category-section" aria-labelledby={`${id}-title`} data-category-id={category.id}>
    <div className="category-heading"><div className="category-title"><span className="category-icon"><ItemIcon icon={category.icon} iconKind={category.iconKind} iconUrl={category.iconUrl} size={21} /></span>
      <div><h2 id={`${id}-title`} tabIndex={-1}>{category.name}</h2><p>{category.description}</p></div>
    </div><span className="category-count">{category.links.length} 个链接</span></div>
    {category.links.length ? <div className="link-grid">{category.links.map((item) => <LinkItemCard item={item} connectivity={connectivity[item.id]} key={item.id} />)}</div>
      : <p className="category-empty">此分类还没有链接</p>}
  </section>;
}
