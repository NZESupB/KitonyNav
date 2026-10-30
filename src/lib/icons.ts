export type CategoryIconKind = "builtin" | "url";
export type LinkIconKind = "builtin" | "url" | "website";

export function sanitizeWebsiteUrl(rawUrl: string): URL | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    parsed.username = "";
    parsed.password = "";
    return parsed;
  } catch {
    return null;
  }
}

function isPrivateHost(hostname: string): boolean {
  if (!hostname || hostname === "localhost") return true;
  if (/^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true;
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return true;
  return false;
}

export function getWebsiteIconCandidates(websiteUrl: string, currentProtocol?: string): string[] {
  const parsed = sanitizeWebsiteUrl(websiteUrl);
  if (!parsed) return [];

  const protocol = currentProtocol ?? (typeof window !== "undefined" ? window.location?.protocol : "");
  const isHttpsPage = protocol === "https:";
  const origin = parsed.origin;
  const hostname = parsed.hostname;
  const isPrivate = isPrivateHost(hostname);

  const candidates: string[] = [];

  // 1. 若为 HTTPS 或页面非 HTTPS，可安全尝试原站直接 Favicon
  if (parsed.protocol === "https:" || !isHttpsPage) {
    candidates.push(`${origin}/favicon.ico`);
    candidates.push(`${origin}/apple-touch-icon.png`);
  }

  // 2. 对于公网域名，追加高可用、支持 CDN/防盗链绕过且符合 HTTPS 安全规范的公共解析源
  if (!isPrivate && hostname.includes(".")) {
    // DuckDuckGo 图标 API：稳定且无防盗链限制，国内外连通率极高
    candidates.push(`https://icons.duckduckgo.com/ip3/${hostname}.ico`);
    // Google 高清 Favicon 服务
    candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`);
    // 一为开源 Favicon 镜像
    candidates.push(`https://api.iowen.cn/favicon/${encodeURIComponent(hostname)}.png`);
  }

  return [...new Set(candidates)];
}
