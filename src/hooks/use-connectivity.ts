import { useEffect, useMemo, useRef, useState } from "react";
import type { LinkItem, ServiceStatus } from "../data";
import { completeConnectivity, connectivityLifetime, expireConnectivity, type ConnectivityResult } from "../lib/connectivity";
import { browserPing } from "../lib/browser-ping";
import { defaultProbeUrl, loadProbeAddress, parseProbeUrl, probeTargetKey, saveProbeAddress, type ProbeConnection } from "../lib/probe";
export type { ConnectivityResult } from "../lib/connectivity";

export type ProbeTarget = { id: number; host: string; port: number };

export function linkProbeTargets(links: LinkItem[]): ProbeTarget[] {
  return links.flatMap((link) => {
    if (link.visible === false || link.connectivityEnabled === false) return [];
    try {
      const url = new URL(link.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") return [];
      return [{ id: link.id, host: url.hostname.replace(/^\[|\]$/g, ""), port: Number(url.port) || (url.protocol === "https:" ? 443 : 80) }];
    } catch { return []; }
  });
}

export function serviceProbeTargets(services: ServiceStatus[]): ProbeTarget[] {
  return services.flatMap((service) => service.enabled !== false && service.checkType === "tcp" && service.target && service.port
    ? [{ id: service.id, host: service.target, port: service.port }] : []);
}

export function useDeviceConnectivity(links: LinkItem[], services: ServiceStatus[]) {
  const [settings, setSettings] = useState(loadProbeAddress);
  const addressRef = useRef(settings.address);
  const [connection] = useState<ProbeConnection>({ address: settings.address, state: "idle" });
  const [linkResults, setLinkResults] = useState<Record<number, ConnectivityResult>>({});

  const validLinks = useMemo(
    () => links.filter((link) => link.visible !== false && link.connectivityEnabled !== false),
    [links]
  );
  const linksSig = JSON.stringify(validLinks.map((l) => ({ id: l.id, url: l.url })));

  // 纯前端并发探测（池大小 4，监听 visibilitychange，生命周期 60s）
  useEffect(() => {
    const candidates = JSON.parse(linksSig) as Array<{ id: number; url: string }>;
    if (candidates.length === 0) return;

    let disposed = false;
    let generation = 0;
    const controllers = new Set<AbortController>();
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const stop = () => {
      generation++;
      controllers.forEach((c) => c.abort());
      controllers.clear();
      timers.forEach(clearTimeout);
      timers.clear();
    };

    const run = async () => {
      stop();
      if (disposed || document.visibilityState === "hidden") return;
      const current = generation;
      const started = Date.now();

      // 初始化或标记刷新
      setLinkResults((prev) =>
        Object.fromEntries(
          candidates.map((c) => [
            c.id,
            prev[c.id]
              ? { ...expireConnectivity(prev[c.id]), refreshing: true }
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
          try {
            const result = await browserPing(item.url, 3500, controller.signal);
            if (result.reachable) {
              res = {
                state: "reachable",
                source: "browser",
                latencyMs: result.latencyMs,
              };
            } else {
              res = {
                state: result.error?.includes("限制") ? "unknown" : "unreachable",
                source: "browser",
                reason: result.error || "请求未连通",
                reasonCode: result.error?.includes("限制") ? "browser-restricted" : undefined,
              };
            }
          } catch {
            res = { state: "unknown", source: "browser", reason: "探测异常终止" };
          } finally {
            controllers.delete(controller);
          }

          if (disposed || current !== generation) return;
          setLinkResults((prev) => ({
            ...prev,
            [item.id]: completeConnectivity(prev[item.id], res),
          }));

          const expireTimer = setTimeout(() => {
            setLinkResults((prev) =>
              prev[item.id] ? { ...prev, [item.id]: expireConnectivity(prev[item.id]) } : prev
            );
          }, connectivityLifetime);
          timers.add(expireTimer);
        }
      };

      const concurrency = Math.min(4, candidates.length);
      await Promise.all(Array.from({ length: concurrency }, worker));

      if (!disposed && current === generation) {
        const nextTimer = setTimeout(() => void run(), Math.max(0, connectivityLifetime - (Date.now() - started)));
        timers.add(nextTimer);
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
  }, [linksSig]);

  const connect = (value = addressRef.current) => {
    let address = value.trim();
    let storageWarning = settings.storageWarning;
    try {
      address = parseProbeUrl(address);
      storageWarning = saveProbeAddress(address);
    } catch { /* ignore */ }
    addressRef.current = address;
    setSettings({ address, storageWarning });
  };

  const currentConnection: ProbeConnection = connection.address === settings.address ? connection : { address: settings.address, state: "idle" };
  const requiredTargets = [...new Set(serviceProbeTargets(services).map((target) => probeTargetKey(target.host, target.port)))].sort();

  return {
    links: linkResults,
    services: {},
    probe: {
      connection: currentConnection,
      storageWarning: settings.storageWarning,
      requiredTargets,
      missingTargets: undefined as string[] | undefined,
      connect,
      reset: () => connect(defaultProbeUrl),
    },
  };
}

export type DeviceProbe = ReturnType<typeof useDeviceConnectivity>["probe"];
