export type LinkItem = {
  id: number;
  name: string;
  description: string;
  url: string;
  icon: string;
  iconKind?: "builtin" | "url";
  iconUrl?: string;
  categoryId: number;
  featured?: boolean;
  visible?: boolean;
  connectivityEnabled?: boolean;
};

export type Category = {
  id: number;
  name: string;
  description: string;
  icon: string;
  iconKind?: "builtin" | "url";
  iconUrl?: string;
  links: LinkItem[];
  visible?: boolean;
};

export type ServiceStatus = {
  id: number;
  name: string;
  status: "online" | "degraded" | "offline" | "unknown";
  latencyMs?: number;
  updatedAt: string;
  enabled?: boolean;
  checkType?: "http" | "tcp" | "none";
  target?: string;
  port?: number;
  sourceStatus?: "online" | "degraded" | "offline" | "unknown";
  sourceUpdatedAt?: string;
  sourceError?: string;
  localState?: "reachable" | "unreachable" | "unknown" | "checking";
  localLatencyMs?: number;
  localCheckedAt?: string;
};

export type UpdateItem = {
  id: number;
  source: "RSS" | "YouTube" | "GitHub";
  title: string;
  time: string;
  url: string;
  subscriptionId?: number;
  publishedAt?: string;
};

export type Subscription = {
  id: number;
  type: "rss" | "github" | "youtube";
  name: string;
  url: string;
  enabled: boolean;
  intervalSeconds: number;
  lastCheckedAt?: string;
  lastError?: string;
  itemCount?: number;
};

export type NetworkInfo = {
  address?: string;
  family?: "IPv4" | "IPv6";
  source?: "http" | "webrtc";
  location?: string;
  isp?: string;
  asn?: string;
  status: "available" | "partial" | "unavailable";
};

export type AppearanceSettings = {
  theme: "system" | "light" | "dark";
  clockStyle: "plain" | "flip" | "ticker" | "glow";
  clock24Hour: boolean;
  clockSeconds: boolean;
  clockColor: string;
  clockSpeed: number;
};

export type BootstrapData = {
  brand: {
    name: string;
    description: string;
  };
  settings: {
    defaultEngine: string;
    weatherLocation: string;
    timezone: string;
    appearance?: AppearanceSettings;
  };
  categories: Category[];
  services: ServiceStatus[];
  updates: UpdateItem[];
  subscriptions?: Subscription[];
  network?: NetworkInfo;
};

// 服务端在配置被删空时会给出 null 列表，统一收敛成数组，避免渲染期崩溃导致整页白屏。
export function normalizeBootstrap(data: BootstrapData): BootstrapData {
  return {
    ...data,
    categories: (data.categories ?? []).map((category) => ({ ...category, links: category.links ?? [] })),
    services: data.services ?? [],
    updates: data.updates ?? [],
    subscriptions: data.subscriptions ?? [],
  };
}

const link = (
  id: number,
  categoryId: number,
  name: string,
  description: string,
  url: string,
  icon: string,
  featured = false,
): LinkItem => ({
  id,
  categoryId,
  name,
  description,
  url,
  icon,
  featured,
  visible: true,
  connectivityEnabled: true,
});

export const fallbackBootstrap: BootstrapData = {
  brand: {
    name: "KitonyNav",
    description: "把常用的站点，放在顺手的位置。",
  },
  settings: {
    defaultEngine: "Google",
    weatherLocation: "上海市",
    timezone: "Asia/Shanghai",
    appearance: {
      theme: "system",
      clockStyle: "plain",
      clock24Hour: true,
      clockSeconds: false,
      clockColor: "#2f6ff3",
      clockSpeed: 1,
    },
  },
  categories: [
    {
      id: 1,
      name: "常用",
      description: "高频访问的网站与服务",
      icon: "star",
      links: [
        link(101, 1, "百度", "搜索引擎", "https://www.baidu.com", "baidu", true),
        link(102, 1, "哔哩哔哩", "视频弹幕网站", "https://www.bilibili.com", "bilibili", true),
        link(103, 1, "微博", "随时随地发现新鲜事", "https://weibo.com", "globe", true),
        link(104, 1, "知乎", "有问题，就会有答案", "https://www.zhihu.com", "book-open", true),
        link(105, 1, "少数派", "高效工作，品质生活", "https://sspai.com", "sspai", true),
        link(106, 1, "掘金", "开发者技术社区", "https://juejin.cn", "juejin", true),
        link(107, 1, "腾讯文档", "在线文档协作", "https://docs.qq.com", "briefcase", true),
        link(108, 1, "飞书", "高效愉悦的办公平台", "https://www.feishu.cn", "cloud", true),
      ],
    },
    {
      id: 2,
      name: "开发",
      description: "开发者常用网站与资源",
      icon: "code",
      links: [
        link(201, 2, "GitHub", "全球领先的代码托管平台", "https://github.com", "github"),
        link(202, 2, "Gitee", "代码托管与研发协作", "https://gitee.com", "gitee"),
        link(203, 2, "Vercel", "前端部署与托管平台", "https://vercel.com", "vercel"),
        link(204, 2, "Docker Hub", "容器镜像服务", "https://hub.docker.com", "docker"),
        link(205, 2, "MDN Web Docs", "Web 开发参考文档", "https://developer.mozilla.org", "mdn"),
        link(206, 2, "Stack Overflow", "开发者问答社区", "https://stackoverflow.com", "stack"),
        link(207, 2, "Postman", "API 开发与测试工具", "https://www.postman.com", "postman"),
        link(208, 2, "JetBrains", "开发者工具套件", "https://www.jetbrains.com", "jetbrains"),
      ],
    },
    {
      id: 3,
      name: "工具",
      description: "提升效率的在线工具",
      icon: "wrench",
      links: [
        link(301, 3, "ChatGPT", "AI 智能助手", "https://chatgpt.com", "openai"),
        link(302, 3, "在线翻译", "多语言翻译", "https://translate.google.com", "languages"),
        link(303, 3, "Iconfont", "阿里图标库", "https://www.iconfont.cn", "palette"),
        link(304, 3, "JSON 格式化", "在线格式化工具", "https://jsonformatter.org", "braces"),
        link(305, 3, "时间戳转换", "时间工具", "https://www.unixtimestamp.com", "clock"),
        link(306, 3, "二维码生成", "在线生成工具", "https://www.qr-code-generator.com", "qr"),
        link(307, 3, "图片压缩", "在线压缩工具", "https://tinypng.com", "image"),
      ],
    },
    {
      id: 4,
      name: "资讯",
      description: "科技资讯与内容平台",
      icon: "newspaper",
      links: [
        link(401, 4, "少数派", "高效工作与生活方式", "https://sspai.com", "sspai"),
        link(402, 4, "36氪", "科技创投资讯", "https://36kr.com", "kr"),
        link(403, 4, "虎嗅", "科技与商业观点", "https://www.huxiu.com", "tiger"),
        link(404, 4, "InfoQ", "技术资讯与实践", "https://www.infoq.cn", "infoq"),
        link(405, 4, "开源中国", "开源技术社区", "https://www.oschina.net", "open-source"),
        link(406, 4, "极客公园", "关注互联网创新", "https://www.geekpark.net", "sparkles"),
      ],
    },
    {
      id: 5,
      name: "云服务",
      description: "云平台与基础服务",
      icon: "cloud",
      links: [
        link(501, 5, "阿里云", "云计算与基础服务", "https://www.aliyun.com", "aliyun"),
        link(502, 5, "腾讯云", "云计算服务", "https://cloud.tencent.com", "cloud"),
        link(503, 5, "华为云", "企业级云服务", "https://www.huaweicloud.com", "cloud"),
        link(504, 5, "AWS", "全球云服务平台", "https://aws.amazon.com", "aws"),
        link(505, 5, "Cloudflare", "网络与安全服务", "https://www.cloudflare.com", "cloudflare"),
        link(506, 5, "Netlify", "前端部署平台", "https://www.netlify.com", "netlify"),
      ],
    },
    {
      id: 6,
      name: "生活",
      description: "生活方式与实用服务",
      icon: "coffee",
      links: [
        link(601, 6, "豆瓣", "发现生活与文化", "https://www.douban.com", "book-open"),
        link(602, 6, "微信读书", "沉浸式阅读", "https://weread.qq.com", "book-open"),
        link(603, 6, "网易云音乐", "发现好音乐", "https://music.163.com", "music"),
        link(604, 6, "美团", "吃喝玩乐一站式", "https://www.meituan.com", "map-pin"),
        link(605, 6, "携程旅行", "旅行预订服务", "https://www.ctrip.com", "plane"),
        link(606, 6, "记账本", "日常财务管理", "https://www.xiaohongshu.com", "wallet"),
      ],
    },
  ],
  services: [
    { id: 1, name: "网站访问", status: "online", latencyMs: 28, updatedAt: "演示数据", enabled: true, checkType: "none", sourceStatus: "unknown" },
    { id: 2, name: "API 服务", status: "online", latencyMs: 36, updatedAt: "演示数据", enabled: true, checkType: "none", sourceStatus: "unknown" },
    { id: 3, name: "数据库", status: "online", latencyMs: 18, updatedAt: "演示数据", enabled: true, checkType: "none", sourceStatus: "unknown" },
    { id: 4, name: "存储服务", status: "online", latencyMs: 31, updatedAt: "演示数据", enabled: true, checkType: "none", sourceStatus: "unknown" },
    { id: 5, name: "邮件服务", status: "degraded", updatedAt: "演示数据", enabled: true, checkType: "none", sourceStatus: "unknown" },
  ],
  updates: [
    { id: 1, source: "RSS", title: "少数派：如何构建一个更顺手的工作台", time: "2 小时前", url: "https://sspai.com" },
    { id: 2, source: "YouTube", title: "前端性能优化的 10 个实用技巧", time: "5 小时前", url: "https://www.youtube.com" },
    { id: 3, source: "GitHub", title: "KitonyNav：导航分类筛选与搜索体验优化", time: "昨天", url: "https://github.com" },
    { id: 4, source: "RSS", title: "InfoQ 精选：云原生应用的可观测性实践", time: "昨天", url: "https://www.infoq.cn" },
    { id: 5, source: "GitHub", title: "React 19.1 正式发布", time: "2 天前", url: "https://github.com/facebook/react/releases" },
  ],
  subscriptions: [],
  network: { status: "unavailable" },
};

export const engineUrls: Record<string, string> = {
  Google: "https://www.google.com/search?q=QUERY",
  百度: "https://www.baidu.com/s?wd=QUERY",
  YouTube: "https://www.youtube.com/results?search_query=QUERY",
  Steam: "https://store.steampowered.com/search/?term=QUERY",
};

export const engineOptions = Object.keys(engineUrls);

// 配置里可能留有已下线的引擎名称，回落到默认引擎，避免取值 undefined 后中断搜索。
export function resolveEngine(value: string | undefined) {
  return value && engineUrls[value] ? value : engineOptions[0];
}
