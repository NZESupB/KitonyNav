import { useEffect, useMemo, useRef, useState } from "react";
import type { LinkItem, ServiceStatus } from "../data";
import { checkConnectivity, completeConnectivity, connectivityLifetime, expireConnectivity, type ConnectivityResult } from "../lib/connectivity";
import { defaultProbeUrl, loadProbeAddress, parseProbeUrl, ProbeError, probeTargetKey, readProbeHealth, saveProbeAddress, type ProbeConnection } from "../lib/probe";
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

type DeviceTarget = ProbeTarget & { type: "link" | "service" };
function targetUrl(base: string, target: ProbeTarget) {
  const key = probeTargetKey(target.host, target.port);
  const host = key.slice(0, key.lastIndexOf(":")).replace(/^\[|\]$/g, "");
  return `${base}/tcping?host=${encodeURIComponent(host)}&port=${target.port}`;
}

export function useDeviceConnectivity(links: LinkItem[], services: ServiceStatus[]) {
  const [settings, setSettings] = useState(loadProbeAddress);
  const addressRef = useRef(settings.address);
  const [connection, setConnection] = useState<ProbeConnection>({ address: settings.address, state: "idle" });
  const [results, setResults] = useState<Record<string, ConnectivityResult>>({});
  const runRef = useRef<(address: string, interactive: boolean) => void>(() => {});
  const targets = useMemo<DeviceTarget[]>(() => [
    ...linkProbeTargets(links).map((target) => ({ ...target, type: "link" as const })),
    ...serviceProbeTargets(services).map((target) => ({ ...target, type: "service" as const })),
  ], [links, services]);
  // 等价的 bootstrap 数组不重启检测；只有真实目标变更才建立新一轮调度。
  const signature = JSON.stringify(targets);
  useEffect(() => {
    const configured = JSON.parse(signature) as DeviceTarget[];
    let disposed = false;
    let generation = 0;
    let interactivePending = false;
    let activeAddress = "";
    const controllers = new Set<AbortController>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const stop = () => {
      generation++;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      timers.forEach(clearTimeout);
      timers.clear();
      interactivePending = false;
    };
    const later = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
      timers.add(timer);
    };
    const run = async (address: string, interactive: boolean) => {
      if (disposed || (interactivePending && activeAddress === address)) return;
      stop();
      if (document.visibilityState === "hidden" && !interactive) return;
      const current = generation;
      const isCurrent = () => !disposed && current === generation;
      let base: string;
      try { base = parseProbeUrl(address); }
      catch (error) {
        setConnection({ address, state: "error", errorCode: "invalid-config", error: (error as Error).message });
        return;
      }
      activeAddress = address;
      interactivePending = interactive;
      const started = Date.now();
      const uniqueTargets = [...new Map(configured.map((target) => [probeTargetKey(target.host, target.port), target])).values()];
      const urls = uniqueTargets.map((target) => targetUrl(base, target));
      setConnection((previous) => ({ address, state: "connecting", lastConnectedAt: previous.address === address ? previous.lastConnectedAt : undefined }));
      setResults((previous) => Object.fromEntries(urls.map((url) => [url, previous[url]
        ? { ...expireConnectivity(previous[url]), refreshing: true }
        : { state: "checking", source: "probe", refreshing: true }])));
      let failure: ProbeError | undefined;
      const healthController = new AbortController();
      controllers.add(healthController);
      try {
        const health = await readProbeHealth(base, healthController.signal, interactive);
        if (!isCurrent()) return;
        setConnection({ address, state: "connected", health, lastConnectedAt: Date.now() });
      } catch (error) {
        if (!isCurrent()) return;
        failure = error instanceof ProbeError ? error : new ProbeError("probe-unavailable", "本机探针不可达，请检查程序及浏览器本地网络权限。");
        const reported = failure;
        setConnection((previous) => ({ address, state: "error", error: reported.message, errorCode: reported.code, lastConnectedAt: previous.lastConnectedAt }));
      } finally {
        controllers.delete(healthController);
        if (isCurrent()) interactivePending = false;
      }
      if (!isCurrent()) return;
      if (document.visibilityState === "hidden") { stop(); return; }
      let next = 0;
      const worker = async () => {
        while (isCurrent() && next < urls.length) {
          const url = urls[next++];
          const controller = new AbortController();
          controllers.add(controller);
          let result: ConnectivityResult;
          try {
            result = failure
              ? { state: "unknown", source: "probe", reasonCode: failure.code, reason: failure.message }
              : await checkConnectivity(url, controller.signal);
          } catch {
            result = { state: "unknown", source: "probe", reasonCode: "probe-unavailable", reason: "本机探针请求中断" };
          } finally { controllers.delete(controller); }
          if (!isCurrent()) return;
          setResults((previous) => ({ ...previous, [url]: completeConnectivity(previous[url], result) }));
          later(() => setResults((previous) => previous[url]
            ? { ...previous, [url]: expireConnectivity(previous[url]) } : previous), connectivityLifetime);
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, urls.length) }, worker));
      if (isCurrent()) later(() => void run(addressRef.current, false), Math.max(0, connectivityLifetime - (Date.now() - started)));
    };
    runRef.current = (address, interactive) => { void run(address, interactive); };
    const onVisibility = () => {
      // 浏览器授权弹窗可能使页面暂时失焦；保留用户发起的健康检查。
      if (interactivePending) return;
      if (document.visibilityState === "hidden") stop();
      else void run(addressRef.current, false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    void run(addressRef.current, false);
    return () => {
      disposed = true;
      stop();
      runRef.current = () => {};
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [signature]);

  const connect = (value = addressRef.current) => {
    let address = value.trim();
    let storageWarning = settings.storageWarning;
    try {
      address = parseProbeUrl(address);
      storageWarning = saveProbeAddress(address);
    } catch { /* 保留错误地址用于诊断，不覆盖已保存的有效配置。 */ }
    addressRef.current = address;
    setSettings({ address, storageWarning });
    // 在用户操作内直接发起 fetch，避免将权限请求延后到 effect。
    runRef.current(address, true);
  };
  let base = "";
  try { base = parseProbeUrl(settings.address); } catch { /* 诊断由连接状态呈现。 */ }
  const currentConnection: ProbeConnection = connection.address === settings.address ? connection : { address: settings.address, state: "idle" };
  const entries = Object.fromEntries(targets.map((target) => {
    const result = base ? results[targetUrl(base, target)] : undefined;
    const fallback: ConnectivityResult = { state: currentConnection.state === "connecting" ? "checking" : "unknown", source: "probe", reason: currentConnection.error, reasonCode: currentConnection.errorCode };
    return [`${target.type}:${target.id}`, result ? expireConnectivity(result) : fallback];
  }));
  const requiredTargets = [...new Set(targets.map((target) => probeTargetKey(target.host, target.port)))].sort();
  const allowed = currentConnection.health ? new Set(currentConnection.health.allowedTargets) : undefined;
  return {
    links: Object.fromEntries(links.map((link) => [link.id, entries[`link:${link.id}`]])),
    services: Object.fromEntries(serviceProbeTargets(services).map((service) => [service.id, entries[`service:${service.id}`]])),
    probe: {
      connection: currentConnection, storageWarning: settings.storageWarning, requiredTargets,
      missingTargets: allowed ? requiredTargets.filter((target) => !allowed.has(target)) : undefined,
      connect, reset: () => connect(defaultProbeUrl),
    },
  };
}

export type DeviceProbe = ReturnType<typeof useDeviceConnectivity>["probe"];
