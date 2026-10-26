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

export function getWebsiteIconCandidates(websiteUrl: string, currentProtocol?: string): string[] {
  const parsed = sanitizeWebsiteUrl(websiteUrl);
  if (!parsed) return [];

  const protocol = currentProtocol ?? (typeof window !== "undefined" ? window.location?.protocol : "");
  // HTTPS 页面不发起明文 HTTP 的图标请求，避免混合内容警告与被阻断
  if (protocol === "https:" && parsed.protocol === "http:") {
    return [];
  }

  const origin = parsed.origin;
  return [
    `${origin}/favicon.ico`,
    `${origin}/apple-touch-icon.png`,
  ];
}
