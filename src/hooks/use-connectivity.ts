import { useEffect, useMemo, useState } from "react";
import type { LinkItem, ServiceStatus } from "../data";
import { withRequestTimeout } from "../lib/network";

export type ConnectivityResult = {
  state: "reachable" | "unreachable" | "unknown" | "checking";
  latencyMs?: number;
  source: "probe" | "browser";
  reason?: string;
  checkedAt?: number;
  expiresAt?: number;
};
export type ProbeTarget = { id: number; host: string; port: number };
type CheckTarget = { id: number; key: string; url: string };
const lifetimeMs = 60_000;

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

async function checkTarget(target: CheckTarget, source: ConnectivityResult["source"], signal: AbortSignal): Promise<ConnectivityResult> {
  return withRequestTimeout(signal, async (signal) => {
    const started = performance.now();
    const response = await fetch(target.url, {
      mode: source === "browser" ? "no-cors" : "cors",
      credentials: "omit", cache: "no-store", signal,
    });
    if (source === "probe") {
      if (!response.ok) throw new Error("本机探针不可用");
      const value = await response.json() as { ok?: boolean; latencyMs?: number };
      if (typeof value.ok !== "boolean") throw new Error("本机探针返回格式不正确");
      return {
        state: value.ok ? "reachable" : "unreachable", source,
        latencyMs: value.ok && typeof value.latencyMs === "number" && Number.isFinite(value.latencyMs) && value.latencyMs >= 0 ? value.latencyMs : undefined,
      };
    }
    if (response.type === "opaque" || response.type === "opaqueredirect") {
      return { state: "unknown", source, reason: "收到不可读的 HTTP 响应，浏览器无法确认状态" };
    }
    return {
      state: response.ok ? "reachable" : "unreachable", source,
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      reason: `HTTP ${response.status}`,
    };
  });
}

function useConnectivityChecks(targets: CheckTarget[], source: ConnectivityResult["source"]) {
  const [results, setResults] = useState<Record<string, ConnectivityResult>>({});
  useEffect(() => {
    let disposed = false;
    let generation = 0;
    const controllers = new Set<AbortController>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const uniqueTargets = [...new Map(targets.map((target) => [target.key, target])).values()];
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
      setResults({});
      if (disposed || document.visibilityState === "hidden" || uniqueTargets.length === 0) return;
      const current = generation;
      const started = Date.now();
      let next = 0;
      const worker = async () => {
        while (!disposed && current === generation && next < uniqueTargets.length) {
          const target = uniqueTargets[next++];
          const controller = new AbortController();
          controllers.add(controller);
          let result: ConnectivityResult;
          try {
            result = await checkTarget(target, source, controller.signal);
          } catch {
            result = { state: "unknown", source, reason: source === "probe" ? "本机探针不可用" : "浏览器无法确认" };
          } finally {
            controllers.delete(controller);
          }
          if (disposed || current !== generation) return;
          const checkedAt = Date.now();
          setResults((previous) => ({ ...previous, [target.key]: { ...result, checkedAt, expiresAt: checkedAt + lifetimeMs } }));
          later(() => setResults((previous) => ({ ...previous, [target.key]: { state: "unknown", source, reason: "检测结果已过期" } })), lifetimeMs);
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, uniqueTargets.length) }, worker));
      if (!disposed && current === generation) later(() => void run(), Math.max(0, lifetimeMs - (Date.now() - started)));
    };
    const onVisibility = () => void run();
    document.addEventListener("visibilitychange", onVisibility);
    void run();
    return () => {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [targets, source]);

  return Object.fromEntries(targets.map((target) => {
    const result = results[target.key];
    const valid = result && (result.expiresAt == null || result.expiresAt > Date.now());
    return [target.id, valid ? result : { state: "unknown", source } as ConnectivityResult];
  }));
}

export function useBrowserConnectivity(links: LinkItem[]) {
  const targets = useMemo(() => links.filter((link) => link.visible !== false && link.connectivityEnabled !== false && /^https?:\/\//i.test(link.url))
    .map((link) => ({ id: link.id, key: link.url, url: link.url })), [links]);
  return useConnectivityChecks(targets, "browser");
}

export function useLocalProbeConnectivity(probes: ProbeTarget[]) {
  let probeBase = "http://127.0.0.1:4711";
  try {
    probeBase = localStorage.getItem("kitony-probe-url") || probeBase;
  } catch {
    // 存储不可用时仍可通过默认本机地址检测。
  }
  const targets = useMemo(() => probes.map((target) => {
    const url = `${probeBase.replace(/\/$/, "")}/tcping?host=${encodeURIComponent(target.host)}&port=${target.port}`;
    return { id: target.id, key: url, url };
  }), [probes, probeBase]);
  return useConnectivityChecks(targets, "probe");
}
