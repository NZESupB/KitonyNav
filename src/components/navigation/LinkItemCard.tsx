import { memo, type CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import type { LinkItem } from "../../data";
import { ItemIcon } from "../icons/ItemIcon";
import { LatencyBadge } from "./LatencyBadge";
import { connectivityKey } from "../../stores/connectivity-store";

export const LinkItemCard = memo(function LinkItemCard({
  item,
  index,
}: {
  item: LinkItem;
  index: number;
}) {
  return (
    <a
      className="link-card"
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ "--card-index": index } as CSSProperties}
    >
      <span className="link-icon">
        <ItemIcon icon={item.icon} iconKind={item.iconKind} iconUrl={item.iconUrl} websiteUrl={item.url} size={21} />
      </span>
      <span className="link-copy">
        <strong>{item.name}</strong>
        <small>{item.description}</small>
      </span>
      {item.connectivityEnabled !== false && <LatencyBadge connectivityKey={connectivityKey.link(item.id)} />}
      <ArrowUpRight className="link-arrow" size={15} />
    </a>
  );
});
