import { motion, useReducedMotion, type Variants } from "motion/react";
import type { Category } from "../../data";
import type { ConnectivityResult } from "../../lib/connectivity";
import { categoryAnchor } from "../../lib/directory";
import { ItemIcon } from "../icons/ItemIcon";
import { LinkItemCard } from "./LinkItemCard";

const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.04,
    },
  },
};
export function CategorySection({ category, connectivity }: { category: Category; connectivity: Record<number, ConnectivityResult | undefined> }) {
  const id = categoryAnchor(category.id);
  const reducedMotion = useReducedMotion();
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
        <motion.div
          className="link-grid"
          variants={reducedMotion ? undefined : gridVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
        >
          {category.links.map((item) => (
            <LinkItemCard item={item} connectivity={connectivity[item.id]} key={item.id} />
          ))}
        </motion.div>
      ) : (
        <p className="category-empty">此分类还没有链接</p>
      )}
    </motion.section>
  );
}
