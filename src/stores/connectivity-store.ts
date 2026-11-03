import { create } from "zustand";
import type { ConnectivityResult } from "../lib/connectivity";

type Updater = (previous: ConnectivityResult | undefined) => ConnectivityResult;

const FLUSH_DELAY_MS = 100;

export const useConnectivityStore = create<{ results: Record<string, ConnectivityResult> }>(() => ({
  results: {},
}));

const queue = new Map<string, Updater>();
let timer: ReturnType<typeof setTimeout> | undefined;

export const connectivityKey = {
  link: (id: number) => `link:${id}`,
  service: (id: number) => `service:${id}`,
};

// 模块常量，保持引用稳定
export const CHECKING_RESULT: ConnectivityResult = { state: "checking", source: "browser" };

export function queueConnectivity(key: string, update: Updater): void {
  const existing = queue.get(key);
  if (existing) {
    queue.set(key, (previous) => update(existing(previous)));
  } else {
    queue.set(key, update);
  }

  if (timer === undefined) {
    timer = setTimeout(flushConnectivity, FLUSH_DELAY_MS);
  }
}

export function flushConnectivity(): void {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  if (queue.size === 0) return;

  const currentResults = useConnectivityStore.getState().results;
  const nextResults: Record<string, ConnectivityResult> = { ...currentResults };
  for (const [key, updater] of queue.entries()) {
    nextResults[key] = updater(nextResults[key]);
  }
  queue.clear();
  useConnectivityStore.setState({ results: nextResults });
}

export function pruneConnectivity(keep: Set<string>): void {
  for (const key of queue.keys()) {
    if (!keep.has(key)) {
      queue.delete(key);
    }
  }

  const currentResults = useConnectivityStore.getState().results;
  let hasPruned = false;
  const nextResults: Record<string, ConnectivityResult> = {};
  for (const [key, value] of Object.entries(currentResults)) {
    if (keep.has(key)) {
      nextResults[key] = value;
    } else {
      hasPruned = true;
    }
  }

  if (hasPruned) {
    useConnectivityStore.setState({ results: nextResults });
  }
}

export function useConnectivity(key: string): ConnectivityResult | undefined {
  return useConnectivityStore((state) => state.results[key]);
}
