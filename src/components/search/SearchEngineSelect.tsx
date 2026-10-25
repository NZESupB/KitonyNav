import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select } from "radix-ui";
import { resolveEngine, searchEngines } from "../../lib/search";

export function SearchEngineSelect({ value, onValueChange, id, disabled = false }: {
  value: string; onValueChange: (value: string) => void; id?: string; disabled?: boolean;
}) {
  return <Select.Root value={resolveEngine(value)} onValueChange={onValueChange} disabled={disabled}>
    <Select.Trigger id={id} className="engine-select-trigger" aria-label="搜索引擎"><Select.Value /><Select.Icon><ChevronDown size={14} /></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Content className="engine-select-content" position="popper" align="end" sideOffset={8} collisionPadding={12}>
      <Select.ScrollUpButton className="engine-select-scroll"><ChevronUp size={15} /></Select.ScrollUpButton>
      <Select.Viewport>
        {["网页搜索", "站内搜索"].map((group) => <Select.Group key={group}>
          <Select.Label className="engine-select-label">{group}</Select.Label>
          {searchEngines.filter((engine) => engine.group === group).map((engine) => <Select.Item className="engine-select-item" value={engine.name} key={engine.name}>
            <Select.ItemText>{engine.name}</Select.ItemText><Select.ItemIndicator><Check size={15} /></Select.ItemIndicator>
          </Select.Item>)}
        </Select.Group>)}
      </Select.Viewport>
      <Select.ScrollDownButton className="engine-select-scroll"><ChevronDown size={15} /></Select.ScrollDownButton>
    </Select.Content></Select.Portal>
  </Select.Root>;
}
