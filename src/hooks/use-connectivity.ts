import { useEffect, useMemo, useState } from "react";
import type { LinkItem, ServiceStatus } from "../data";
import { completeConnectivity, connectivityLifetime, expireConnectivity, type ConnectivityResult } from "../lib/connectivity";
import { browserPing } from "../lib/browser-ping";
export type { ConnectivityResult } from "../lib/connectivity";

type PingCandidate = {
  key: string;
  id: number;
  type: "link" | "service";
  url?: string;
  isCustomTcp?: boolean;
};

export function useDeviceConnectivity(links: LinkItem[], services: ServiceStatus[]) {
  const [results, setResults] = useState<Record<string, ConnectivityResult>>({});

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
        if (service.checkType === "http" && service.target && /^https?:\/\//i.test(service.target)) {
          return { key: `service:${service.id}`, id: service.id, type: "service" as const, url: service.target };
        }
        return { key: `service:${service.id}`, id: service.id, type: "service" as const, isCustomTcp: true };
      });

    return [...linkItems, ...serviceItems];
  }, [links, services]);

  const signature = useMemo(
    () => candidates.map((c) => `${c.key}:${c.url || "tcp"}`).join(","),
    [candidates]
  );

  useEffect(() => {
    if (candidates.length === 0) return;

    let disposed = false;
    let generation = 0;
    const controllers = new Set<AbortController>();
    let loopTimer: ReturnType<typeof setTimeout> | undefined;

    const stop = () => {
      generation++;
      controllers.forEach((c) => c.abort());
      controllers.clear();
      if (loopTimer) clearTimeout(loopTimer);
    };

    const run = async () => {
      stop();
      if (disposed || document.visibilityState === "hidden") return;
      const current = generation;
      const started = Date.now();

      // 批量初始化占位状态
      setResults((prev) =>
        Object.fromEntries(
          candidates.map((c) => [
            c.key,
            prev[c.key]
              ? { ...expireConnectivity(prev[c.key]), refreshing: true }
              : { state: "checking", source: "browser", refreshing: true },
          ])
        )
      );

      let nextIndex = 0;
      const worker = async () => {
        while (!disposed && current === generation && nextIndex < candidates.length) {
          const item = candidates[nextIndex++];
          const controller = new AbortController();
          controllers.add(controller);

          let res: ConnectivityResult;
          if (item.isCustomTcp || !item.url) {
            res = {
              state: "unknown",
              source: "browser",
              reason: "纯浏览器模式无法探测非 HTTP 原始 TCP 端口",
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
          setResults((prev) => ({
            ...prev,
            [item.key]: completeConnectivity(prev[item.key], res),
          }));
        }
      };

      const concurrency = Math.min(4, candidates.length);
      await Promise.all(Array.from({ length: concurrency }, worker));

      if (!disposed && current === generation) {
        loopTimer = setTimeout(
          () => void run(),
          Math.max(0, connectivityLifetime - (Date.now() - started))
        );
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
  }, [signature, candidates]);

  return {
    links: Object.fromEntries(links.map((link) => [link.id, results[`link:${link.id}`] ? expireConnectivity(results[`link:${link.id}`]) : { state: "checking" as const, source: "browser" as const }])),
    services: Object.fromEntries(services.map((service) => [service.id, results[`service:${service.id}`] ? expireConnectivity(results[`service:${service.id}`]) : { state: "checking" as const, source: "browser" as const }])),
  };
}
