import { createContext, useContext, useEffect, useId, useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select } from "radix-ui";

export const FormControlsDisabled = createContext(false);
export type SelectOption = { value: string; label: string; group?: string; disabled?: boolean };

type ThemedSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

export function ThemedSelect({ value, onValueChange, options, id, disabled = false, placeholder, className = "", ...labels }: ThemedSelectProps) {
  const generatedId = useId();
  const formDisabled = useContext(FormControlsDisabled);
  const unavailable = disabled || formDisabled;
  const [open, setOpen] = useState(false);
  useEffect(() => { if (unavailable) setOpen(false); }, [unavailable]);
  const groups = [...new Set(options.map((option) => option.group))];
  return <Select.Root value={value} onValueChange={(next) => { if (!unavailable) onValueChange(next); }}
    disabled={unavailable} open={!unavailable && open} onOpenChange={(next) => setOpen(next && !unavailable)}>
    <Select.Trigger id={id ?? generatedId} className={`themed-select-trigger ${className}`} {...labels}>
      <Select.Value placeholder={placeholder} /><Select.Icon><ChevronDown size={14} /></Select.Icon>
    </Select.Trigger>
    <Select.Portal><Select.Content className="themed-select-content" position="popper" sideOffset={6} collisionPadding={12}>
      <Select.ScrollUpButton className="themed-select-scroll"><ChevronUp size={15} /></Select.ScrollUpButton>
      <Select.Viewport>{groups.map((group) => <Select.Group key={group ?? "ungrouped"}>
        {group && <Select.Label className="themed-select-label">{group}</Select.Label>}
        {options.filter((option) => option.group === group).map((option) => <Select.Item key={option.value} value={option.value}
          disabled={unavailable || option.disabled} className="themed-select-item" textValue={option.label}>
          <Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator><Check size={15} /></Select.ItemIndicator>
        </Select.Item>)}
      </Select.Group>)}</Select.Viewport>
      <Select.ScrollDownButton className="themed-select-scroll"><ChevronDown size={15} /></Select.ScrollDownButton>
    </Select.Content></Select.Portal>
  </Select.Root>;
}
