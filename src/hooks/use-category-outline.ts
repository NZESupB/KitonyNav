import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { Category } from "../data";
import { categoryAnchor } from "../lib/directory";
import { useUIStore } from "../stores/ui-store";
import { useMediaQuery } from "./use-media-query";

export function useCategoryOutline(categories: Category[]) {
  const location = useLocation();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const setActiveSectionId = useUIStore((state) => state.setActiveSectionId);
  const ids = categories.map((category) => category.id).join(",");

  useEffect(() => {
    const nodes = ids.split(",").filter(Boolean).map((id) => document.getElementById(categoryAnchor(Number(id)))).filter((node): node is HTMLElement => !!node);
    if (!nodes.length) { setActiveSectionId(null); return; }
    let observer: IntersectionObserver | undefined;
    const end = document.querySelector("[data-outline-end]");
    const update = () => {
      const line = Math.min(120, window.innerHeight / 4);
      // 两个观察器共用同一判断，页底的短分类不能被阅读线观察器覆盖。
      const atEnd = window.scrollY > 0 && end != null && end.getBoundingClientRect().top <= window.innerHeight;
      const current = atEnd ? nodes.at(-1)! : [...nodes].reverse().find((node) => node.getBoundingClientRect().top <= line + 1) ?? nodes[0];
      setActiveSectionId(Number(current.dataset.categoryId));
    };
    const setup = () => {
      observer?.disconnect();
      const line = Math.min(120, window.innerHeight / 4);
      observer = new IntersectionObserver(update, { rootMargin: `-${line}px 0px -${Math.max(0, window.innerHeight - line - 1)}px 0px` });
      nodes.forEach((node) => observer!.observe(node));
      update();
    };
    setup();
    const bottomObserver = new IntersectionObserver(update);
    if (end) bottomObserver.observe(end);
    window.addEventListener("resize", setup);
    return () => { observer?.disconnect(); bottomObserver.disconnect(); window.removeEventListener("resize", setup); setActiveSectionId(null); };
  }, [ids, setActiveSectionId]);

  useEffect(() => {
    const targetId = ids.split(",").map(Number).find((id) => `#${categoryAnchor(id)}` === location.hash);
    if (targetId == null) return;
    let secondFrame = 0;
    const frame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const node = document.getElementById(categoryAnchor(targetId));
        node?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
        node?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      });
    });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); };
  }, [location.key, location.hash, ids, reducedMotion]);
}
