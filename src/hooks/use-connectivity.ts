import { useEffect, useMemo, useRef } from "react";
import type { LinkItem, ServiceStatus } from "../data";
import { completeConnectivity, type ConnectivityResult } from "../lib/connectivity";
import { browserPing } from "../lib/browser-ping";
import {
  flushConnectivity,
  pruneConnectivity,
  queueConnectivity,
} from "../stores/connectivity-store";

export type { ConnectivityResult } from "../lib/connectivity";

type PingCandidate = {
  key: string;
  id: number;
  type: "link" | "service";
  url?: string;
};

const PING_INTERVAL_MS = 10_000;

export function useDeviceConnectivity(links: LinkItem[], services: ServiceStatus[]): void {
  const candidates = useMemo<PingCandidate[]>(() => {
    const linkItems: PingCandidate[] = links
      .filter((link) => link.visible !== false && link.connectivityEnabled !== false)
      .map((link) => ({
        key: `link:${link.id}`,
        id: link.id,
        type: "link" as const,
        url: link.url,
      }));

    const serviceItems: PingCandidate[] = services
      .filter((service) => service.enabled !== false)
      .map((service) => {
        const target = service.target?.trim();
        const isHttpUrl = Boolean(target && /^https?:\/\//i.test(target));
        return {
          key: `service:${service.id}`,
          id: service.id,
          type: "service" as const,
          url: isHttpUrl ? target : undefined,
        };
      });

    return [...linkItems, ...serviceItems];
  }, [links, services]);

  const signature = useMemo(
    () => candidates.map((c) => `${c.key}:${c.url || "none"}`).join(","),
    [candidates]
  );

  const candidatesRef = useRef(candidates);
  useEffect(() => {
    candidatesRef.current = candidates;
  });

  useEffect(() => {
    const currentCandidates = candidatesRef.current;
    if (currentCandidates.length === 0) {
      // 候选全部移除时同样清理历史结果
      pruneConnectivity(new Set());
      return;
    }

    let disposed = false;
    let generation = 0;
    const controllers = new Set<AbortController>();
    let loopTimer: ReturnType<typeof setTimeout> | undefined;

    const stop = () => {
      generation++;
      controllers.forEach((c) => c.abort());
      controllers.clear();
      if (loopTimer) {
        clearTimeout(loopTimer);
        loopTimer = undefined;
      }
    };

    const run = async () => {
      stop();
      if (disposed || document.visibilityState === "hidden") return;
      const current = generation;
      const started = Date.now();
      const runCandidates = candidatesRef.current;

      // 清理不在当前探测列表中的历史 key
      pruneConnectivity(new Set(runCandidates.map((c) => c.key)));

      // 批量初始化平滑占位状态：保留上轮实测延迟，仅打上 refreshing 标记，防止数值突变闪烁
      for (const c of runCandidates) {
        queueConnectivity(c.key, (prev) => {
          if (prev) {
            return { ...prev, refreshing: true };
          }
          return { state: "checking", source: "browser", refreshing: true };
        });
      }
      flushConnectivity();

      let nextIndex = 0;
      const worker = async () => {
        while (!disposed && current === generation && nextIndex < runCandidates.length) {
          const item = runCandidates[nextIndex++];
          const controller = new AbortController();
          controllers.add(controller);

          let res: ConnectivityResult;
          if (!item.url) {
            res = {
              state: "unknown",
              source: "browser",
              reason: "未配置检测地址",
            };
          } else {
            try {
              const pingRes = await browserPing(item.url, 3500, controller.signal);
              if (pingRes.reachable) {
                res = {
                  state: "reachable",
                  source: "browser",
                  latencyMs: pingRes.latencyMs,
                };
              } else {
                res = {
                  state: pingRes.error?.includes("限制") ? "unknown" : "unreachable",
                  source: "browser",
                  reason: pingRes.error || "请求未连通",
                  reasonCode: pingRes.error?.includes("限制") ? "browser-restricted" : undefined,
                };
              }
            } catch {
              res = { state: "unknown", source: "browser", reason: "探测异常终止" };
            } finally {
              controllers.delete(controller);
            }
          }

          if (disposed || current !== generation) return;
          queueConnectivity(item.key, (prev) => completeConnectivity(prev, res));
        }
      };

      const concurrency = Math.min(4, runCandidates.length);
      await Promise.all(Array.from({ length: concurrency }, worker));

      if (!disposed && current === generation) {
        // 固定 10 秒自动重新测速，减去本轮测速已消耗耗时，平滑衔接
        const elapsed = Date.now() - started;
        const delay = Math.max(1_000, PING_INTERVAL_MS - elapsed);
        loopTimer = setTimeout(() => void run(), delay);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        void run();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    void run();

    return () => {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [signature]);
}
