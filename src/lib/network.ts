export async function withRequestTimeout<T>(
  signal: AbortSignal,
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 5000,
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, timeoutMs);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}

// 仅接受可用于出口展示的公网地址，排除回环、私网、文档和保留范围。
export function isPublicAddress(address: string): boolean {
  if (/^\d+(?:\.\d+){3}$/.test(address)) {
    const parts = address.split(".").map(Number);
    if (parts.some((part) => part < 0 || part > 255)) return false;
    const number = parts.reduce((value, part) => value * 256 + part, 0);
    const reserved = [
      [0x00000000, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8],
      [0xa9fe0000, 16], [0xac100000, 12], [0xc0000000, 24], [0xc0000200, 24],
      [0xc0586300, 24], [0xc0a80000, 16], [0xc6120000, 15], [0xc6336400, 24],
      [0xcb007100, 24], [0xe0000000, 4], [0xf0000000, 4],
    ];
    return !reserved.some(([base, bits]) => Math.floor(number / 2 ** (32 - bits)) === Math.floor(base / 2 ** (32 - bits)));
  }
  if (!address.includes(":") || address.includes("%")) return false;
  try {
    const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
    const [first, second] = normalized.split(":").map((part) => parseInt(part || "0", 16));
    if (first < 0x2000 || first > 0x3fff) return false;
    return !(first === 0x2001 && (second < 0x200 || second === 0xdb8))
      && first !== 0x2002 && first < 0x3fff;
  } catch {
    return false;
  }
}

export function publicStunAddress(candidate: RTCIceCandidate): string | undefined {
  const fields = candidate.candidate.trim().split(/\s+/);
  const type = candidate.type ?? fields[fields.indexOf("typ") + 1];
  const address = candidate.address ?? fields[4];
  return type === "srflx" && address && isPublicAddress(address) ? address : undefined;
}

export type VisitorGeo = { ip?: string; location?: string; isp?: string; asn?: string };

export async function fetchVisitorGeo(signal: AbortSignal): Promise<VisitorGeo> {
  const providers: Array<(signal: AbortSignal) => Promise<VisitorGeo>> = [
    async (signal) => {
      const response = await fetch("https://api.ip.sb/geoip", { signal, credentials: "omit", cache: "no-store" });
      if (!response.ok) throw new Error("IP 信息查询失败");
      const value = await response.json();
      return { ip: value.ip, location: [value.country, value.city || value.region].filter(Boolean).join(" · "), isp: value.isp || value.organization || value.asn_organization, asn: value.asn == null ? undefined : String(value.asn) };
    },
    async (signal) => {
      const response = await fetch("https://ipwho.is/", { signal, credentials: "omit", cache: "no-store" });
      if (!response.ok) throw new Error("IP 信息查询失败");
      const value = await response.json();
      if (value.success === false) throw new Error("IP 信息不可用");
      return { ip: value.ip, location: [value.country, value.city || value.region].filter(Boolean).join(" · "), isp: value.connection?.isp || value.connection?.org, asn: value.connection?.asn == null ? undefined : `AS${value.connection.asn}` };
    },
    async (signal) => {
      const response = await fetch("https://ipapi.co/json/", { signal, credentials: "omit", cache: "no-store" });
      if (!response.ok) throw new Error("IP 信息查询失败");
      const value = await response.json();
      if (value.error) throw new Error("IP 信息不可用");
      return { ip: value.ip, location: [value.country_name, value.city || value.region].filter(Boolean).join(" · "), isp: value.org, asn: value.asn };
    },
  ];
  for (const provider of providers) {
    if (signal.aborted) break;
    try {
      const value = await withRequestTimeout(signal, provider);
      if (typeof value.ip === "string" && isPublicAddress(value.ip)) return value;
    } catch {
      // 单个来源超时或失败时继续尝试下一来源，取消整个任务时停止。
    }
  }
  return {};
}
