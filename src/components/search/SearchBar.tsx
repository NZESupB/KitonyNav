import { useRef } from "react";
import { Search } from "lucide-react";
import { useSearchShortcut } from "../../hooks/use-search-shortcut";
import { SearchEngineSelect } from "./SearchEngineSelect";

export function SearchBar({ query, onChange, engine, onEngineChange, onSearch }: {
  query: string; onChange: (value: string) => void; engine: string; onEngineChange: (value: string) => void; onSearch: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const shortcut = useSearchShortcut(input);
  return <div className="search-wrap">
    <form className={`search-box ${query ? "has-value" : ""}`} role="search" onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
      <Search size={22} strokeWidth={1.7} aria-hidden="true" />
      <input ref={input} value={query} onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }}
        placeholder={`搜索收藏或使用引擎（${shortcut.label}）`} aria-label="搜索收藏或使用搜索引擎" aria-keyshortcuts={shortcut.ariaShortcut} />
      <div className="search-actions"><SearchEngineSelect value={engine} onValueChange={onEngineChange} /><kbd className="search-shortcut">{shortcut.label}</kbd></div>
      <button className="visually-hidden" type="submit">使用 {engine} 搜索</button>
    </form>
    <p className="search-help">输入筛选收藏，按 Enter 使用 {engine} 搜索</p>
  </div>;
}
