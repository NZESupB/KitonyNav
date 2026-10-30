import type { CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import type { LinkItem } from "../../data";
import type { ConnectivityResult } from "../../lib/connectivity";
import { ItemIcon } from "../icons/ItemIcon";
import { LatencyBadge } from "./LatencyBadge";

export function LinkItemCard({
  item,
  connectivity,
  index = 0,
}: {
  item: LinkItem;
  connectivity?: ConnectivityResult;
  index?: number;
}) {
  return (
    <a
      className="link-card link-card-animated"
      style={{ "--card-index": index } as CSSProperties}
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
    </a>
  );
}
