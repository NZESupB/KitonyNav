import { motion, useReducedMotion, type Variants } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import type { LinkItem } from "../../data";
import type { ConnectivityResult } from "../../lib/connectivity";
import { ItemIcon } from "../icons/ItemIcon";
import { LatencyBadge } from "./LatencyBadge";
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.34,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};
export function LinkItemCard({
  item,
  connectivity,
}: {
  item: LinkItem;
  connectivity?: ConnectivityResult;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.a
      className="link-card"
      variants={reducedMotion ? undefined : cardVariants}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="link-icon">
        <ItemIcon icon={item.icon} iconKind={item.iconKind} iconUrl={item.iconUrl} websiteUrl={item.url} size={21} />
      </span>
      <span className="link-copy">
        <strong>{item.name}</strong>
        <small>{item.description}</small>
      </span>
      {item.connectivityEnabled !== false && <LatencyBadge result={connectivity} />}
      <ArrowUpRight className="link-arrow" size={15} />
    </motion.a>
  );
}
