import { memo, useState } from "react";
import { motion } from "motion/react";
import type { Category } from "../../data";
import { categoryAnchor } from "../../lib/directory";
import { ItemIcon } from "../icons/ItemIcon";
import { LinkItemCard } from "./LinkItemCard";

export const CategorySection = memo(function CategorySection({ category }: { category: Category }) {
  const id = categoryAnchor(category.id);
  const [revealed, setRevealed] = useState(false);

  return (
    <motion.section
      id={id}
      className="category-section"
      aria-labelledby={`${id}-title`}
      data-category-id={category.id}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      onViewportEnter={() => setRevealed(true)}
    >
      <div className="category-heading">
        <div className="category-title">
          <span className="category-icon">
            <ItemIcon icon={category.icon} iconKind={category.iconKind} iconUrl={category.iconUrl} size={21} />
          </span>
          <div>
            <h2 id={`${id}-title`} tabIndex={-1}>{category.name}</h2>
            <p>{category.description}</p>
          </div>
        </div>
        <span className="category-count">{category.links.length} 个链接</span>
      </div>
      {category.links.length ? (
        <div className="link-grid" data-revealed={revealed ? "" : undefined}>
          {category.links.map((item, index) => (
            <LinkItemCard item={item} index={index} key={item.id} />
          ))}
        </div>
      ) : (
        <p className="category-empty">此分类还没有链接</p>
      )}
    </motion.section>
  );
});
