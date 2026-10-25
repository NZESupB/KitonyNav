import { useEffect, type RefObject } from "react";
import { isMacPlatform, matchesSearchShortcut } from "../lib/search";

export function useSearchShortcut(input: RefObject<HTMLInputElement | null>) {
  const mac = isMacPlatform();
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="listbox"], [role="menu"]')) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const editing = target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
      if (matchesSearchShortcut(event, mac) || (event.key === "/" && !editing && !event.metaKey && !event.ctrlKey && !event.altKey)) {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [input, mac]);
  return { label: mac ? "⌘K" : "Ctrl+K", ariaShortcut: mac ? "Meta+K" : "Control+K" };
}
