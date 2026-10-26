import { resolveEngine, searchEngines } from "../../lib/search";
import { ThemedSelect } from "../ui/ThemedSelect";

export function SearchEngineSelect({ value, onValueChange, id, disabled = false }: {
  value: string; onValueChange: (value: string) => void; id?: string; disabled?: boolean;
}) {
  return <ThemedSelect value={resolveEngine(value)} onValueChange={onValueChange} id={id} disabled={disabled}
    aria-label="搜索引擎" className="engine-select-trigger"
    options={searchEngines.map((engine) => ({ value: engine.name, label: engine.name, group: engine.group }))} />;
}
