export const searchEngines = [
  { name: "Google", group: "网页搜索", url: "https://www.google.com/search", param: "q" },
  { name: "百度", group: "网页搜索", url: "https://www.baidu.com/s", param: "wd" },
  { name: "Bing", group: "网页搜索", url: "https://www.bing.com/search", param: "q" },
  { name: "DuckDuckGo", group: "网页搜索", url: "https://duckduckgo.com/", param: "q" },
  { name: "YouTube", group: "站内搜索", url: "https://www.youtube.com/results", param: "search_query" },
  { name: "哔哩哔哩", group: "站内搜索", url: "https://search.bilibili.com/all", param: "keyword" },
  { name: "Steam", group: "站内搜索", url: "https://store.steampowered.com/search/", param: "term" },
] as const;
export const engineOptions = searchEngines.map((engine) => engine.name);
export const engineUrls: Record<string, string> = Object.fromEntries(searchEngines.map((engine) => [engine.name, `${engine.url}?${engine.param}=QUERY`]));

export function resolveEngine(value: string | undefined): string {
  return searchEngines.some((engine) => engine.name === value) ? value! : "Google";
}

export function buildSearchUrl(engineName: string, query: string): string {
  const engine = searchEngines.find((engine) => engine.name === resolveEngine(engineName))!;
  const url = new URL(engine.url);
  url.searchParams.set(engine.param, query.trim());
  return url.toString();
}

type PlatformInfo = { userAgentData?: { platform?: string }; platform?: string; userAgent?: string };
export function isMacPlatform(platform: PlatformInfo = typeof navigator === "undefined" ? {} : navigator): boolean {
  return /mac/i.test(platform.userAgentData?.platform || platform.platform || platform.userAgent || "");
}

export function matchesSearchShortcut(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">, mac: boolean): boolean {
  return event.key.toLowerCase() === "k" && !event.altKey && !event.shiftKey
    && (mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey);
}
