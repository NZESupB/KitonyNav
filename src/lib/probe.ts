import { withRequestTimeout } from "./network";

export const defaultProbeUrl = "http://127.0.0.1:4711";
export const probeStorageKey = "kitony-probe-url";
export type ProbeErrorCode = "invalid-config" | "probe-http" | "invalid-response" | "request-timeout" | "probe-unavailable";
export class ProbeError extends Error {
  constructor(public code: ProbeErrorCode, message: string) { super(message); }
}
export type ProbeHealth = {
  status: "ok";
  service: "kitonynav-probe";
  protocolVersion: 1;
  allowedTargets: string[];
};
export type ProbeConnection = {
  address: string;
  state: "idle" | "connecting" | "connected" | "error";
  error?: string;
  errorCode?: ProbeErrorCode;
  health?: ProbeHealth;
  lastConnectedAt?: number;
};

export function parseProbeUrl(value: string): string {
  try {
    if (!/^https?:\/\//i.test(value.trim()) || /[?#\\]/.test(value)) throw new Error();
    const url = new URL(value.trim());
    const loopback = url.hostname === "localhost" || url.hostname === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(url.hostname);
    if (!loopback || !["http:", "https:"].includes(url.protocol) || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash || url.port === "0") throw new Error();
    return url.origin;
  } catch {
    throw new ProbeError("invalid-config", "请输入 HTTP(S) 本机回环地址（localhost、127.x.x.x 或 [::1]），仅含端口和根路径，不含账号、查询或片段。");
  }
}

export function loadProbeAddress(): { address: string; storageWarning?: string } {
  try { return { address: localStorage.getItem(probeStorageKey) ?? defaultProbeUrl }; }
  catch { return { address: defaultProbeUrl, storageWarning: "本地存储不可用，地址仅在当前页面生效。" }; }
}

export function saveProbeAddress(address: string): string | undefined {
  try { localStorage.setItem(probeStorageKey, address); }
  catch { return "无法保存到本地存储，地址仅在当前页面生效。"; }
}

export async function readProbeHealth(baseUrl: string, signal: AbortSignal, interactive: boolean): Promise<ProbeHealth> {
  try {
    return await withRequestTimeout(signal, async (requestSignal) => {
      const response = await fetch(`${baseUrl}/healthz`, {
        mode: "cors", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal: requestSignal,
      });
      if (!response.ok) throw new ProbeError("probe-http", `探针健康检查失败（HTTP ${response.status}）${response.status === 403 ? "，请核对 --origins 是否包含当前网页来源" : ""}`);
      let value: unknown;
      try { value = await response.json(); }
      catch (error) {
        if (requestSignal.aborted) throw error;
        throw new ProbeError("invalid-response", "探针健康响应不是有效 JSON，请检查地址。");
      }
      const health = value as Partial<ProbeHealth> | null;
      if (!health || typeof health !== "object" || health.status !== "ok" || health.service !== "kitonynav-probe" ||
          health.protocolVersion !== 1 || !Array.isArray(health.allowedTargets) || !health.allowedTargets.every((target) => typeof target === "string")) {
        throw new ProbeError("invalid-response", "该地址不是兼容的本机探针，请检查地址或升级探针。");
      }
      return health as ProbeHealth;
    }, interactive ? 30_000 : 3_000);
  } catch (error) {
    if (signal.aborted || error instanceof ProbeError) throw error;
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new ProbeError("request-timeout", "连接探针超时，请确认程序运行，并允许当前站点访问本地网络后重试。");
    }
    throw new ProbeError("probe-unavailable", "本机探针不可达：可能未启动，或受到浏览器权限、来源白名单、CORS 或代理限制。请按下方步骤检查。");
  }
}

export function probeTargetKey(host: string, port: number): string {
  let normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (normalized.includes(":")) {
    try { normalized = new URL(`http://[${normalized}]/`).hostname.slice(1, -1); } catch { /* 非法目标交由探针明确拒绝。 */ }
    // 与 Go net.IP.String 一致，把 IPv4 映射地址收敛为 IPv4。
    const mapped = /^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/.exec(normalized);
    if (mapped) {
      const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
      return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}:${port}`;
    }
    return `[${normalized}]:${port}`;
  }
  return `${normalized}:${port}`;
}

// POSIX shell 单引号转义；仅生成文本，不执行网页配置中的内容。
export function shellQuote(value: string): string { return `'${value.replace(/'/g, `'"'"'`)}'`; }
export function probeStartCommand(targets: string[], origin: string, address: string): string {
  const url = new URL(parseProbeUrl(address));
  if (url.protocol === "https:") return "HTTPS 地址需自行配置回环 TLS 终端；内置探针提供 HTTP。可恢复默认地址后生成启动命令。";
  const host = url.hostname === "localhost" ? "127.0.0.1" : url.hostname;
  return `go -C server run ./cmd/kitonynav-probe --listen ${shellQuote(`${host}:${url.port || "80"}`)} --allow ${shellQuote(targets.join(","))} --origins ${shellQuote(origin)}`;
}
