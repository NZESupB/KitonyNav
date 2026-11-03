import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Tabs } from "radix-ui";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { ItemIcon } from "../components/icons/ItemIcon";
import type { BootstrapData, UpdateItem } from "../data";

export default function UpdatesPage({ data }: { data: BootstrapData }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"全部" | UpdateItem["source"]>("全部");
  const updates = filter === "全部" ? data.updates : data.updates.filter((item) => item.source === filter);
  return (
    <motion.main className="page-content updates-page route-page-container" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
      <div className="page-heading"><div><span className="eyebrow">订阅与缓存</span><h1>动态</h1><p>把 RSS、YouTube 和 GitHub 的更新放在一个安静的列表里。</p></div><button className="primary-button" onClick={() => queryClient.invalidateQueries({ queryKey: ["bootstrap"] })}><RefreshCw size={16} /> 刷新全部</button></div>
      <Tabs.Root value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
      <Tabs.List className="filter-tabs" aria-label="动态来源">
        {(["全部", "RSS", "YouTube", "GitHub"] as const).map((item) => (
          <Tabs.Trigger value={item}
            className={filter === item ? "active" : ""}
            key={item}
          >
            {filter === item && <motion.span layoutId="active-filter-tab" className="tab-pill-active" transition={{ type: "spring", bounce: 0.15, duration: 0.35 }} />}
            <span>{item}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value={filter}>
        <div className="updates-table">{updates.map((item) => <a className="updates-table-row" href={item.url} target="_blank" rel="noreferrer" key={item.id}><span className={`source-chip ${item.source.toLowerCase()}`}><ItemIcon icon={item.source === "RSS" ? "rss" : item.source.toLowerCase()} size={15} />{item.source}</span><span className="updates-table-title">{item.title}</span><time>{item.time}</time><ArrowUpRight size={16} /></a>)}</div>
        {updates.length === 0 && <p className="empty-updates" role="status">暂无{filter === "全部" ? "" : ` ${filter} `}动态，可在设置中添加或刷新订阅。</p>}
      </Tabs.Content>
      </Tabs.Root>
    </motion.main>
  );
}
