import { useEffect, useMemo, useState } from "react";
import type { LinkItem, ServiceStatus } from "../data";
import { withRequestTimeout } from "../lib/network";
import { checkConnectivity, completeConnectivity, connectivityLifetime, expireConnectivity, type CheckTarget, type ConnectivityResult } from "../lib/connectivity";
export type { ConnectivityResult } from "../lib/connectivity";

export type ProbeTarget = { id: number; host: string; port: number };

export function linkProbeTargets(links: LinkItem[]): ProbeTarget[] {
  return links.flatMap((link) => {
    if (link.visible === false || link.connectivityEnabled === false) return [];
    try {
      const url = new URL(link.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") return [];
      return [{ id: link.id, host: url.hostname.replace(/^\[|\]$/g, ""), port: Number(url.port) || (url.protocol === "https:" ? 443 : 80) }];
    } catch {
      return [];
    }
  });
}

export function serviceProbeTargets(services: ServiceStatus[]): ProbeTarget[] {
  return services.flatMap((service) => service.enabled !== false && service.checkType === "tcp" && service.target && service.port
    ? [{ id: service.id, host: service.target, port: service.port }] : []);
}

function useConnectivityChecks(targets: CheckTarget[], healthUrl: string) {
  const [results, setResults] = useState<Record<string, ConnectivityResult>>({});
  // Bootstrap 轮询得到等价的新数组时不重启检测，在途任务按完整目标键隔离。
  const signature = JSON.stringify(targets);
  useEffect(() => {
    const source = "probe";
    const configured = JSON.parse(signature) as CheckTarget[];
    const uniqueTargets = [...new Map(configured.map((target) => [target.key, target])).values()];
    let disposed = false;
    let generation = 0;
    const controllers = new Set<AbortController>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const stop = () => {
      generation++;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      timers.forEach(clearTimeout);
      timers.clear();
    };
    const later = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
      timers.add(timer);
    };
    const run = async () => {
      stop();
      if (disposed || document.visibilityState === "hidden" || uniqueTargets.length === 0) return;
      const current = generation;
      const started = Date.now();
      setResults((previous) => Object.fromEntries(uniqueTargets.map((target) => [target.key, previous[target.key]
        ? { ...expireConnectivity(previous[target.key]), refreshing: true }
        : { state: "checking", source, refreshing: true }])));
      let probeError: string | undefined;
      const healthController = new AbortController();
      controllers.add(healthController);
      try {
        await withRequestTimeout(healthController.signal, async (signal) => {
          const response = await fetch(healthUrl, { signal, credentials: "omit", cache: "no-store" });
          if (!response.ok || (await response.json()).status !== "ok") throw new Error("探针健康检查失败");
        }, 1500);
      } catch {
        probeError = "本机探针未启动、不可访问或被浏览器权限限制";
      } finally {
        controllers.delete(healthController);
      }
      let next = 0;
      const worker = async () => {
        while (!disposed && current === generation && next < uniqueTargets.length) {
          const target = uniqueTargets[next++];
          const controller = new AbortController();
          controllers.add(controller);
          let result: ConnectivityResult;
          try {
            if (probeError) result = { state: "unknown", source, reasonCode: "probe-unavailable", reason: probeError };
            else result = await checkConnectivity(target.url, controller.signal);
          } catch (error) {
            result = { state: "unknown", source, reasonCode: "probe-unavailable", reason: error instanceof Error && error.name !== "TypeError" && error.name !== "AbortError"
              ? error.message : "本机探针不可访问或请求超时" };
          } finally {
            controllers.delete(controller);
          }
          if (disposed || current !== generation) return;
          const checkedAt = Date.now();
          setResults((previous) => ({ ...previous, [target.key]: completeConnectivity(previous[target.key], result, checkedAt) }));
          later(() => setResults((previous) => ({ ...previous, [target.key]: expireConnectivity(previous[target.key]) })), connectivityLifetime);
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, uniqueTargets.length) }, worker));
      if (!disposed && current === generation) later(() => void run(), Math.max(0, connectivityLifetime - (Date.now() - started)));
    };
    const onVisibility = () => void run();
    document.addEventListener("visibilitychange", onVisibility);
    void run();
    return () => {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [signature, healthUrl]);

  return Object.fromEntries(targets.map((target) => [target.id, results[target.key]
    ? expireConnectivity(results[target.key]) : { state: "checking", source: "probe" } as ConnectivityResult]));
}

export function useDeviceConnectivity(links: LinkItem[], services: ServiceStatus[]) {
  let probeBase = "http://127.0.0.1:4711";
  try {
    const saved = localStorage.getItem("kitony-probe-url");
    if (saved && /^https?:\/\//i.test(saved)) probeBase = new URL(saved).origin;
  } catch {
    // 存储或旧地址无效时采用默认本机地址。
  }
  const probeTargets = useMemo(() => [
    ...linkProbeTargets(links).map((target) => ({ ...target, type: "link" })),
    ...serviceProbeTargets(services).map((target) => ({ ...target, type: "service" })),
  ].map((target) => {
    const url = `${probeBase}/tcping?host=${encodeURIComponent(target.host)}&port=${target.port}`;
    return { id: `${target.type}:${target.id}`, key: url, url };
  }), [links, services, probeBase]);
  const probe = useConnectivityChecks(probeTargets, `${probeBase}/healthz`);
  return {
    links: Object.fromEntries(links.map((link) => [link.id, probe[`link:${link.id}`]])),
    services: Object.fromEntries(serviceProbeTargets(services).map((service) => [service.id, probe[`service:${service.id}`]])),
  };
}
