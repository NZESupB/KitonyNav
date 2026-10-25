import { ArrowUpRight } from "lucide-react";
import type { LinkItem } from "../../data";
import type { ConnectivityResult } from "../../lib/connectivity";
import { ItemIcon } from "../icons/ItemIcon";
import { LatencyBadge } from "./LatencyBadge";

export function LinkItemCard({ item, connectivity }: { item: LinkItem; connectivity?: ConnectivityResult }) {
  return <a className="link-card" href={item.url} target="_blank" rel="noopener noreferrer">
    <span className="link-icon"><ItemIcon icon={item.icon} iconKind={item.iconKind} iconUrl={item.iconUrl} size={21} /></span>
    <span className="link-copy"><strong>{item.name}</strong><small>{item.description}</small></span>
    {item.connectivityEnabled !== false && <LatencyBadge result={connectivity} />}
    <ArrowUpRight className="link-arrow" size={15} />
  </a>;
}
