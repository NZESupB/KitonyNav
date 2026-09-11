import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Braces,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudSun,
  Code2,
  Coffee,
  Command,
  Edit3,
  Globe2,
  House,
  Image,
  Languages,
  LayoutGrid,
  Link2,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Plane,
  Plus,
  QrCode,
  RefreshCw,
  Rss,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Wrench,
  X,
  Clock3,
  Music2,
  Wallet,
  Wifi,
} from "lucide-react";
import {
  SiBaidu,
  SiBilibili,
  SiCloudflare,
  SiDocker,
  SiFigma,
  SiGitee,
  SiGithub,
  SiGitea,
  SiGoogle,
  SiJetbrains,
  SiMdnwebdocs,
  SiNetlify,
  SiNpm,
  SiNotion,
  SiOpenai,
  SiPostman,
  SiReact,
  SiStackoverflow,
  SiVercel,
  SiYoutube,
} from "react-icons/si";
import {
  createCategory,
  createLink,
  createService,
  createSubscription,
  deleteCategory,
  deleteLink,
  deleteService,
  deleteSubscription,
  fetchBootstrap,
  fetchClientNetwork,
  fetchSession,
  login,
  logout,
  updateCategory,
  updateLink,
  updateSettings,
  updateService,
  updateSubscription,
  refreshService,
  refreshSubscription,
} from "./api";
import { engineOptions, engineUrls, normalizeBootstrap, resolveEngine, type AppearanceSettings, type BootstrapData, type Category, type LinkItem, type ServiceStatus, type Subscription, type UpdateItem } from "./data";

type Theme = "system" | "light" | "dark";
type IconKey = string;
type LinkConnectivity = "reachable" | "unreachable" | "unknown" | "checking";
type ConnectivityResult = { state: LinkConnectivity; latencyMs?: number; source?: "probe" | "browser" };

const iconOptions = ["folder", "star", "code", "wrench", "newspaper", "cloud", "coffee", "globe", "book-open", "briefcase", "sparkles", "github", "youtube", "openai", "rss"];
const clockStyles: Array<AppearanceSettings["clockStyle"]> = ["plain", "flip", "ticker", "glow"];

const brandIcons: Record<string, IconType> = {
  baidu: SiBaidu,
  bilibili: SiBilibili,
  cloudflare: SiCloudflare,
  docker: SiDocker,
  figma: SiFigma,
  gitee: SiGitee,
  gitea: SiGitea,
  github: SiGithub,
  google: SiGoogle,
  jetbrains: SiJetbrains,
  mdn: SiMdnwebdocs,
  netlify: SiNetlify,
  npm: SiNpm,
  notion: SiNotion,
  openai: SiOpenai,
  postman: SiPostman,
  react: SiReact,
  stack: SiStackoverflow,
  vercel: SiVercel,
  youtube: SiYoutube,
};

const uiIcons: Record<string, typeof Star> = {
  activity: Activity,
  book: BookOpen,
  "book-open": BookOpen,
  braces: Braces,
  briefcase: BriefcaseBusiness,
  cloud: Cloud,
  coffee: Coffee,
  code: Code2,
  globe: Globe2,
  image: Image,
  languages: Languages,
  map: MapPin,
  "map-pin": MapPin,
  music: Music2,
  newspaper: Newspaper,
  palette: Palette,
  plane: Plane,
  qr: QrCode,
  rss: Rss,
  sparkles: Sparkles,
  star: Star,
  wrench: Wrench,
  clock: Clock3,
  wallet: Wallet,
};

function ItemIcon({ icon, iconKind = "builtin", iconUrl, size = 20 }: { icon: IconKey; iconKind?: "builtin" | "url"; iconUrl?: string; size?: number }) {
  if (iconKind === "url" && iconUrl) return <CustomIcon icon={icon} iconUrl={iconUrl} size={size} />;
  const BrandIcon = brandIcons[icon];
  if (BrandIcon) return <BrandIcon size={size} aria-hidden="true" />;
  const UiIcon = uiIcons[icon] ?? Link2;
  return <UiIcon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function CustomIcon({ icon, iconUrl, size }: { icon: IconKey; iconUrl: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ItemIcon icon={icon} size={size} />;
  return <img className="custom-icon" src={iconUrl} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />;
}

function relativeTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    const delta = Math.max(0, Date.now() - parsed);
    const minutes = Math.floor(delta / 60_000);
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return days < 7 ? `${days} 天前` : new Date(parsed).toLocaleDateString("zh-CN");
  }
  return value;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function formatClock(now: Date, timezone: string | undefined, appearance: AppearanceSettings) {
  const time = now.toLocaleTimeString("zh-CN", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: appearance.clockSeconds ? "2-digit" : undefined, hour12: !appearance.clock24Hour });
  const date = now.toLocaleDateString("zh-CN", { timeZone: timezone, month: "long", day: "numeric", weekday: "short" });
  return { time, date };
}

// 非法时区名称会让 Intl 抛出 RangeError 并中断整棵渲染树，因此只把可用名称交给格式化函数。
function safeTimezone(timezone: string | undefined) {
  const value = (timezone ?? "").trim();
  if (!value) return undefined;
  try {
    return new Intl.DateTimeFormat("zh-CN", { timeZone: value }).resolvedOptions().timeZone || value;
  } catch {
    return undefined;
  }
}

function nextTheme(theme: Theme): Theme {
  return theme === "system" ? "light" : theme === "light" ? "dark" : "system";
}

function themeLabel(theme: Theme) {
  return theme === "system" ? "跟随系统" : theme === "light" ? "浅色模式" : "深色模式";
}

type VisitorGeo = { ip?: string; location?: string; isp?: string; asn?: string };

async function fetchVisitorGeo(): Promise<VisitorGeo> {
  const providers: Array<() => Promise<VisitorGeo>> = [
    async () => {
      const response = await fetch("https://api.ip.sb/geoip", { credentials: "omit", cache: "no-store" });
      if (!response.ok) throw new Error("ip.sb unavailable");
      const value = await response.json() as { ip?: string; country?: string; region?: string; city?: string; isp?: string; organization?: string; asn_organization?: string; asn?: string };
      if (!value.ip) throw new Error("ip.sb missing ip");
      return { ip: value.ip, location: [value.country, value.city || value.region].filter(Boolean).join(" · "), isp: value.isp || value.organization || value.asn_organization, asn: value.asn };
    },
    async () => {
      const response = await fetch("https://ipwho.is/", { credentials: "omit", cache: "no-store" });
      if (!response.ok) throw new Error("ipwho unavailable");
      const value = await response.json() as { success?: boolean; ip?: string; country?: string; region?: string; city?: string; connection?: { isp?: string; org?: string; asn?: number | string } };
      if (value.success === false || !value.ip) throw new Error("ipwho missing ip");
      return { ip: value.ip, location: [value.country, value.city || value.region].filter(Boolean).join(" · "), isp: value.connection?.isp || value.connection?.org, asn: value.connection?.asn ? `AS${value.connection.asn}` : undefined };
    },
    async () => {
      const response = await fetch("https://ipapi.co/json/", { credentials: "omit", cache: "no-store" });
      if (!response.ok) throw new Error("ipapi unavailable");
      const value = await response.json() as { error?: boolean; ip?: string; country_name?: string; region?: string; city?: string; org?: string; asn?: string };
      if (value.error || !value.ip) throw new Error("ipapi missing ip");
      return { ip: value.ip, location: [value.country_name, value.city || value.region].filter(Boolean).join(" · "), isp: value.org, asn: value.asn };
    },
  ];
  for (const provider of providers) {
    try { return await provider(); } catch { /* try the next public provider */ }
  }
  return {};
}

function useSystemDark() {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setDark(media.matches);
    media.addEventListener?.("change", handleChange);
    return () => media.removeEventListener?.("change", handleChange);
  }, []);
  return dark;
}

function useBrowserConnectivity(links: LinkItem[]) {
  const [states, setStates] = useState<Record<number, ConnectivityResult>>({});
  useEffect(() => {
    let active = true;
    const candidates = links.filter((item) => item.connectivityEnabled !== false && /^https?:\/\//i.test(item.url));
    if (candidates.length === 0) return () => { active = false; };
    setStates((current) => Object.fromEntries(candidates.map((item) => [item.id, current[item.id] ?? { state: "checking", source: "browser" }])));
    candidates.forEach((item) => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 5000);
      const started = performance.now();
      fetch(item.url, { mode: "no-cors", cache: "no-store", signal: controller.signal })
        .then((response) => {
          if (!active) return;
          const state: LinkConnectivity = response.ok || response.type === "opaque" ? "reachable" : "unreachable";
          setStates((current) => ({ ...current, [item.id]: { state, latencyMs: Math.max(1, Math.round(performance.now() - started)), source: "browser" } }));
        })
        .catch(() => { if (active) setStates((current) => ({ ...current, [item.id]: { state: "unknown", source: "browser" } })); })
        .finally(() => { window.clearTimeout(timer); });
    });
    return () => { active = false; };
  }, [links]);
  return states;
}

type ProbeTarget = { id: number; host: string; port: number };

function useLocalProbeConnectivity(targets: ProbeTarget[]) {
  const [states, setStates] = useState<Record<number, ConnectivityResult>>({});
  useEffect(() => {
    let active = true;
    const probeBase = localStorage.getItem("kitony-probe-url") || "http://127.0.0.1:4711";
    targets.forEach((target) => {
      const url = `${probeBase.replace(/\/$/, "")}/tcping?host=${encodeURIComponent(target.host)}&port=${target.port}`;
      fetch(url, { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("probe unavailable");
          const value = await response.json() as { ok?: boolean; latencyMs?: number };
          if (active) setStates((current) => ({ ...current, [target.id]: { state: value.ok ? "reachable" : "unreachable", latencyMs: value.latencyMs, source: "probe" } }));
        })
        .catch(() => undefined);
    });
    return () => { active = false; };
  }, [targets]);
  return states;
}

function App() {
  return <AppShell />;
}

function AppShell() {
  const { data, isFetching } = useQuery({ queryKey: ["bootstrap"], queryFn: fetchBootstrap, staleTime: 30_000 });
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("kitony-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("kitony-sidebar") === "collapsed");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const resolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
    document.documentElement.dataset.theme = resolved;
    localStorage.setItem("kitony-theme", theme);
    if (theme !== "system") return;
    const handleChange = () => { document.documentElement.dataset.theme = media.matches ? "dark" : "light"; };
    media.addEventListener?.("change", handleChange);
    return () => media.removeEventListener?.("change", handleChange);
  }, [theme]);

  useEffect(() => {
    if (!data) return;
    document.title = data.brand.name || "KitonyNav";
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", theme === "dark" ? "#11151c" : "#edf1f7");
  }, [data, theme]);

  useEffect(() => {
    if (localStorage.getItem("kitony-theme") === null && data?.settings.appearance?.theme) setTheme(data.settings.appearance.theme);
  }, [data?.settings.appearance?.theme]);

  useEffect(() => {
    localStorage.setItem("kitony-sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  const appData = data ? normalizeBootstrap(data) : undefined;

  if (!appData) {
    return <div className="app-loading"><div className="loading-orb" /><span>准备你的导航空间</span></div>;
  }

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${mobileMenuOpen ? "mobile-menu-open" : ""}`}>
      <Sidebar
        data={appData}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />
      <div className="workspace">
        <TopBar data={appData} theme={theme} setTheme={setTheme} onOpenMenu={() => setMobileMenuOpen(true)} />
        <Routes>
          <Route path="/" element={<HomePage data={appData} activeCategory={activeCategory} setActiveCategory={setActiveCategory} isFetching={isFetching} />} />
          <Route path="/updates" element={<UpdatesPage data={appData} />} />
          <Route path="/admin" element={<AdminPage data={appData} />} />
          <Route path="*" element={<HomePage data={appData} activeCategory={activeCategory} setActiveCategory={setActiveCategory} isFetching={isFetching} />} />
        </Routes>
      </div>
    </div>
  );
}

function Sidebar({
  data,
  collapsed,
  setCollapsed,
  activeCategory,
  setActiveCategory,
  mobileMenuOpen,
  setMobileMenuOpen,
}: {
  data: BootstrapData;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  activeCategory: number | null;
  setActiveCategory: (value: number | null) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (value: boolean) => void;
}) {
  return (
    <>
      <AnimatePresence>
        {mobileMenuOpen && <motion.button className="mobile-scrim" aria-label="关闭导航" onClick={() => setMobileMenuOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}
      </AnimatePresence>
      <motion.aside className="sidebar" initial={false} animate={{ width: collapsed ? 82 : 252 }} transition={{ type: "spring", bounce: 0, duration: 0.38 }}>
        <div className="sidebar-inner">
          <div className="brand-lockup">
            <div className="brand-mark"><img src="/favicon.svg" alt="" width="34" height="34" /></div>
            {!collapsed && <div className="brand-name">{data.brand.name || "KitonyNav"}</div>}
          </div>
          <button className="mobile-close icon-button" onClick={() => setMobileMenuOpen(false)} aria-label="关闭导航"><X size={20} /></button>
          <nav className="primary-nav" aria-label="主导航">
            <NavItem to="/" icon={<House size={19} />} label="首页" collapsed={collapsed} exact />
            <NavItem to="/updates" icon={<MessageCircle size={19} />} label="动态" collapsed={collapsed} />
            <NavItem to="/admin" icon={<Settings2 size={19} />} label="设置" collapsed={collapsed} />
          </nav>
          <div className="sidebar-rule" />
          <div className="sidebar-section-heading">
            {!collapsed && <span>收藏夹</span>}
            <button className="icon-button subtle" title="添加收藏夹" aria-label="添加收藏夹"><Plus size={17} /></button>
          </div>
          <div className="sidebar-folders">
            {data.categories.map((category) => (
              <button
                className={`folder-row ${activeCategory === category.id ? "selected" : ""}`}
                key={category.id}
                onClick={() => setActiveCategory(activeCategory === category.id ? null : category.id)}
                title={collapsed ? category.name : undefined}
              >
                <ItemIcon icon={category.icon} iconKind={category.iconKind} iconUrl={category.iconUrl} size={17} />
                {!collapsed && <><span>{category.name}{category.name === "常用" ? "网站" : ""}</span><MoreHorizontal size={16} className="folder-more" /></>}
              </button>
            ))}
          </div>
          <div className="sidebar-spacer" />
          <div className="sidebar-footer">
            <button className="collapse-button" onClick={() => setCollapsed(!collapsed)} title={collapsed ? "展开侧栏" : "收起侧栏"} aria-label={collapsed ? "展开侧栏" : "收起侧栏"}>
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

function NavItem({ to, icon, label, collapsed, exact }: { to: string; icon: ReactNode; label: string; collapsed: boolean; exact?: boolean }) {
  return (
    <NavLink to={to} end={exact} className={({ isActive }) => `nav-row ${isActive ? "active" : ""}`} title={collapsed ? label : undefined}>
      {icon}<span className={collapsed ? "visually-hidden" : ""}>{label}</span>
    </NavLink>
  );
}

function TopBar({ data, theme, setTheme, onOpenMenu }: { data: BootstrapData; theme: Theme; setTheme: (value: Theme) => void; onOpenMenu: () => void }) {
  const now = useClock();
  const appearance = data.settings.appearance ?? { theme: "system", clockStyle: "plain", clock24Hour: true, clockSeconds: false, clockColor: "#2f6ff3", clockSpeed: 1 };
  const timezone = useMemo(() => safeTimezone(data.settings.timezone), [data.settings.timezone]);
  const { time, date } = formatClock(now, timezone, appearance);
  const clockClass = `clock-${appearance.clockStyle}`;
  const systemDark = useSystemDark();
  const activeTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  return (
    <header className="topbar">
      <button className="mobile-menu-button icon-button" onClick={onOpenMenu} aria-label="打开导航"><Menu size={20} /></button>
      <div className="topbar-meta">
        <span className="weather-inline"><CloudSun size={19} /><span>{data.settings.weatherLocation}</span><strong>24°C</strong><em>多云</em></span>
        <span className="topbar-divider" />
        <span className={`time-inline ${clockClass}`} style={{ "--clock-color": appearance.clockColor } as CSSProperties}><Clock3 size={18} /><strong>{time}</strong><span>{date}</span></span>
        <span className="topbar-divider" />
        <button className="topbar-theme" onClick={() => setTheme(nextTheme(theme))} aria-label={`切换主题，当前${themeLabel(theme)}`} title="切换主题">{activeTheme === "dark" ? <Moon size={18} /> : <Sun size={18} />}<span>{themeLabel(theme)}</span><ChevronDown size={15} /></button>
      </div>
    </header>
  );
}

function HomePage({ data, activeCategory, setActiveCategory, isFetching }: { data: BootstrapData; activeCategory: number | null; setActiveCategory: (value: number | null) => void; isFetching: boolean }) {
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState(() => resolveEngine(data.settings.defaultEngine));
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();
  const visibleLinks = useMemo(() => data.categories.flatMap((category) => category.links), [data.categories]);
  const browserConnectivity = useBrowserConnectivity(visibleLinks);
  const linkProbeTargets = useMemo(() => visibleLinks.flatMap((item) => {
    try { const parsed = new URL(item.url); return [{ id: item.id, host: parsed.hostname, port: Number(parsed.port) || (parsed.protocol === "https:" ? 443 : 80) }]; } catch { return []; }
  }), [visibleLinks]);
  const serviceProbeTargets = useMemo(() => data.services.flatMap((service) => service.checkType === "tcp" && service.target && service.port ? [{ id: service.id, host: service.target, port: service.port }] : []), [data.services]);
  const linkProbeConnectivity = useLocalProbeConnectivity(linkProbeTargets);
  const serviceConnectivity = useLocalProbeConnectivity(serviceProbeTargets);
  const connectivity = useMemo(() => ({ ...browserConnectivity, ...linkProbeConnectivity }), [browserConnectivity, linkProbeConnectivity]);

  const visibleCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.categories
      .filter((category) => category.visible !== false && (activeCategory === null || category.id === activeCategory))
      .map((category) => ({
        ...category,
        links: category.links.filter((item) => item.visible !== false && (!normalized || `${item.name} ${item.description}`.toLowerCase().includes(normalized))),
      }))
      .filter((category) => category.links.length > 0);
  }, [activeCategory, data.categories, query]);

  const openSearch = () => {
    const raw = query.trim();
    if (!raw) return;
    const bangMap: Record<string, string> = { "!bd": "百度", "!yt": "YouTube", "!st": "Steam" };
    const parts = raw.split(/\s+/);
    const bangEngine = bangMap[parts[0].toLowerCase()];
    const activeEngine = bangEngine || engine;
    const searchQuery = bangEngine ? parts.slice(1).join(" ") : raw;
    if (!searchQuery) return;
    const target = engineUrls[resolveEngine(activeEngine)].replace("QUERY", encodeURIComponent(searchQuery));
    window.open(target, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="home-layout">
      <div className="home-main">
        <div className="search-wrap">
          <div className={`search-box ${query ? "has-value" : ""}`}>
            <Search size={22} strokeWidth={1.7} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") openSearch(); }} placeholder="搜索或输入网址" aria-label="搜索或输入网址" />
            <div className="search-actions">
              <select value={engine} onChange={(event) => setEngine(event.target.value)} aria-label="搜索引擎">
                {engineOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
              <span className="search-shortcut"><Command size={13} /> K</span>
            </div>
          </div>
          <div className="engine-hints">
            <span>快捷搜索</span>
            {engineOptions.map((option) => <button key={option} className={engine === option ? "active" : ""} onClick={() => setEngine(option)}>{option}</button>)}
            <span className="hint-divider" />
            <button onClick={() => setQuery("!bd ")}>!bd</button><button onClick={() => setQuery("!yt ")}>!yt</button><button onClick={() => setQuery("!st ")}>!st</button>
          </div>
        </div>

        <div className={`home-content-header ${query ? "" : "compact"}`}>
          <div>{query && <><span className="eyebrow">搜索结果 · {visibleCategories.reduce((count, item) => count + item.links.length, 0)} 个链接</span><h1>找到你要去的地方</h1></>}</div>
          <div className="header-actions"><button className="quiet-button" onClick={() => navigate("/admin")}><SlidersHorizontal size={16} /> 管理内容</button></div>
        </div>

        <div className="directory-list">
          {visibleCategories.slice(0, query || activeCategory !== null || showAll ? undefined : 3).map((category) => <CategorySection category={category} connectivity={connectivity} key={category.id} onMore={() => setActiveCategory(category.id)} />)}
        </div>

        {!query && activeCategory === null && visibleCategories.length > 3 && <button className="show-more-button" onClick={() => setShowAll(!showAll)}>{showAll ? "收起分类" : "查看全部分类"}<ChevronDown size={16} className={showAll ? "rotated" : ""} /></button>}

        <div className="bottom-panels">
          <StatusPanel services={data.services} compact localConnectivity={serviceConnectivity} />
          <UpdatesPanel updates={data.updates} compact />
        </div>
        <NetworkPanel />
        <div className="sync-banner"><div className="sync-icon"><Activity size={17} /></div><div><strong>{isFetching ? "正在同步" : "内容已同步"}</strong><span>服务、订阅和设备网络信息会按配置刷新。</span></div><span className="sync-time">{isFetching ? "同步中" : "刚刚同步"}</span></div>
      </div>
      <aside className="home-rail">
        <StatusPanel services={data.services} localConnectivity={serviceConnectivity} />
        <UpdatesPanel updates={data.updates} />
      </aside>
    </main>
  );
}

function CategorySection({ category, connectivity, onMore }: { category: Category; connectivity: Record<number, ConnectivityResult>; onMore: () => void }) {
  return (
    <section className="category-section">
      <div className="category-heading"><div className="category-title"><span className="category-icon"><ItemIcon icon={category.icon} iconKind={category.iconKind} iconUrl={category.iconUrl} size={21} /></span><div><h2>{category.name}</h2><p>{category.description}</p></div></div><button className="category-more" onClick={onMore} aria-label={`查看${category.name}全部链接`}><ChevronRight size={19} /></button></div>
      <div className="link-grid">
        {category.links.slice(0, 8).map((item) => <LinkItemCard item={item} connectivity={connectivity[item.id]} key={item.id} />)}
        {category.links.length > 8 && <button className="link-card more-card" onClick={onMore}><span><MoreHorizontal size={20} /></span><div><strong>更多链接</strong><small>查看该分类全部内容</small></div></button>}
      </div>
    </section>
  );
}

function LinkItemCard({ item, connectivity }: { item: LinkItem; connectivity?: ConnectivityResult }) {
  const state = connectivity?.state ?? "unknown";
  const metric = connectivity?.latencyMs != null ? `${connectivity.latencyMs} ms` : state === "checking" ? "…" : "—";
  const label = state === "reachable" ? `本机延迟 ${metric}` : state === "checking" ? "检测中" : state === "unknown" ? "无法确认" : "连接失败";
  return (
    <a className="link-card" href={item.url} target="_blank" rel="noreferrer">
      <span className="link-icon"><ItemIcon icon={item.icon} iconKind={item.iconKind} iconUrl={item.iconUrl} size={21} /></span>
      <span className="link-copy"><strong>{item.name}</strong><small>{item.description}</small></span>
      <span className={`link-metric ${state}`} title={label} aria-label={label}><span className="connectivity-dot" />{metric}</span>
      <ArrowUpRight className="link-arrow" size={15} />
    </a>
  );
}

function StatusPanel({ services, compact = false, localConnectivity = {} }: { services: BootstrapData["services"]; compact?: boolean; localConnectivity?: Record<number, ConnectivityResult> }) {
  const statusLabel = (service: ServiceStatus) => service.checkType === "none" ? "未配置" : service.status === "online" ? "正常" : service.status === "degraded" ? "异常" : service.status === "offline" ? "离线" : "待检查";
  return (
    <section className={`rail-panel status-panel ${compact ? "compact-panel" : ""}`}>
      <div className="panel-heading"><div><span className="panel-kicker"><Activity size={14} /> 服务状态</span>{!compact && <h3>你关注的服务</h3>}</div></div>
      <div className="status-list">
        {services.filter((service) => service.enabled !== false).slice(0, compact ? 4 : 5).map((service) => { const localResult = localConnectivity[service.id]; return <div className="status-row" key={service.id}><span className={`status-dot ${service.checkType === "none" ? "unknown" : service.status}`} /><span className="status-name">{service.name}</span><span className={`status-label ${service.checkType === "none" ? "unknown" : service.status}`}>{statusLabel(service)}</span>{service.latencyMs != null && service.checkType !== "none" && !compact && <span className="status-latency">服务器 {service.latencyMs}ms</span>}{service.checkType && service.checkType !== "none" && !compact && <span className="status-source"><Wifi size={12} /> {service.checkType.toUpperCase()}</span>}{localResult && <span className={`connectivity-label ${localResult.state}`} title="访问设备上的本机探针结果">{localResult.latencyMs != null ? `本机 ${localResult.latencyMs}ms` : localResult.state === "checking" ? "本机检测中" : localResult.state === "unreachable" ? "本机失败" : "本机未确认"}</span>}</div>; })}
      </div>
    </section>
  );
}

function NetworkPanel() {
  const [httpInfo, setHttpInfo] = useState<{ address?: string; family?: string; status: string }>({ status: "unavailable" });
  const [webrtcAddress, setWebrtcAddress] = useState("");
  const [geoInfo, setGeoInfo] = useState<VisitorGeo>({});
  const [userAgent] = useState(() => navigator.userAgent);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { fetchClientNetwork().then(setHttpInfo).catch(() => setHttpInfo({ status: "unavailable" })); }, []);
  useEffect(() => {
    let active = true;
    fetchVisitorGeo().then((value) => { if (active) setGeoInfo(value); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (typeof RTCPeerConnection === "undefined") return;
    let active = true;
    const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peer.createDataChannel("kitony-network");
    peer.onicecandidate = (event) => {
      const candidate = event.candidate?.candidate || "";
      const match = candidate.match(/candidate:\S+ \S+ \S+ \S+ ([^ ]+) /);
      if (active && match?.[1] && !match[1].endsWith(".local")) setWebrtcAddress(match[1]);
    };
    peer.createOffer().then((offer) => peer.setLocalDescription(offer)).catch(() => undefined);
    const timer = window.setTimeout(() => peer.close(), 5000);
    return () => { active = false; window.clearTimeout(timer); peer.close(); };
  }, []);
  const ipAddress = geoInfo.ip || httpInfo.address || webrtcAddress || "无法确认";
  const location = geoInfo.location || "无法确认";
  const operator = [geoInfo.isp, geoInfo.asn].filter(Boolean).join(" · ") || "无法确认";
  const ipFamily = ipAddress.includes(":") ? "IPv6" : ipAddress.match(/^\d+(?:\.\d+){3}$/) ? "IPv4" : httpInfo.family || "检测中";
  const toggleExpanded = () => setExpanded((value) => !value);
  return <aside className={`network-float ${expanded ? "expanded" : ""}`} aria-label="网络出口信息" role="button" tabIndex={0} aria-expanded={expanded} onClick={toggleExpanded} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleExpanded(); } }}><div className="network-float-summary"><span className="network-float-mark"><Globe2 size={14} /></span><span className="network-pill" title={location}>{location}</span><span className="network-pill network-pill-ip" title={ipAddress}>{ipAddress}</span><span className="network-float-source">{ipFamily}</span></div>{expanded && <dl className="network-float-details"><div><dt>IP 地址</dt><dd>{ipAddress}</dd></div><div><dt>位置</dt><dd>{location}</dd></div><div><dt>运营商</dt><dd>{operator}</dd></div><div><dt>UA</dt><dd title={userAgent}>{userAgent}</dd></div></dl>}</aside>;
}

function UpdatesPanel({ updates, compact = false }: { updates: UpdateItem[]; compact?: boolean }) {
  return (
    <section className={`rail-panel updates-panel ${compact ? "compact-panel" : ""}`}>
      <div className="panel-heading"><div><span className="panel-kicker"><Rss size={14} /> 最近动态</span>{!compact && <h3>订阅源正在更新</h3>}</div><button className="panel-action" title="查看全部动态" aria-label="查看全部动态"><ChevronRight size={17} /></button></div>
      <div className="update-list">
        {updates.slice(0, compact ? 4 : 5).map((item) => <a className="update-row" href={item.url} target="_blank" rel="noreferrer" key={item.id}><span className={`source-dot ${item.source.toLowerCase()}`} /><span className="update-title">{item.title}</span><time>{relativeTime(item.time)}</time></a>)}
      </div>
      <NavLink className="panel-link" to="/updates">查看更多动态 <ArrowUpRight size={14} /></NavLink>
    </section>
  );
}

function UpdatesPage({ data }: { data: BootstrapData }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"全部" | UpdateItem["source"]>("全部");
  const updates = filter === "全部" ? data.updates : data.updates.filter((item) => item.source === filter);
  return (
    <main className="page-content updates-page">
      <div className="page-heading"><div><span className="eyebrow">订阅与缓存</span><h1>动态</h1><p>把 RSS、YouTube 和 GitHub 的更新放在一个安静的列表里。</p></div><button className="primary-button" onClick={() => queryClient.invalidateQueries({ queryKey: ["bootstrap"] })}><RefreshCw size={16} /> 刷新全部</button></div>
      <div className="filter-tabs" role="tablist">{(["全部", "RSS", "YouTube", "GitHub"] as const).map((item) => <button role="tab" aria-selected={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div>
      <div className="updates-table">{updates.map((item) => <a className="updates-table-row" href={item.url} target="_blank" rel="noreferrer" key={item.id}><span className={`source-chip ${item.source.toLowerCase()}`}>{item.source === "RSS" ? <Rss size={14} /> : item.source === "YouTube" ? <SiYoutube size={15} /> : <SiGithub size={15} />}{item.source}</span><span className="updates-table-title">{item.title}</span><time>{item.time}</time><ArrowUpRight size={16} /></a>)}</div>
    </main>
  );
}

function AdminPage({ data }: { data: BootstrapData }) {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: fetchSession, staleTime: 10_000 });
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<"categories" | "links" | "services" | "subscriptions" | "settings">("categories");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("folder");
  const [categoryIconKind, setCategoryIconKind] = useState<"builtin" | "url">("builtin");
  const [categoryIconUrl, setCategoryIconUrl] = useState("");
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [linkName, setLinkName] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkIcon, setLinkIcon] = useState("globe");
  const [linkIconKind, setLinkIconKind] = useState<"builtin" | "url">("builtin");
  const [linkIconUrl, setLinkIconUrl] = useState("");
  const [linkConnectivity, setLinkConnectivity] = useState(true);
  const [linkCategory, setLinkCategory] = useState(data.categories[0]?.id ?? 1);
  const [editingService, setEditingService] = useState<ServiceStatus | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceEnabled, setServiceEnabled] = useState(true);
  const [serviceCheckType, setServiceCheckType] = useState<ServiceStatus["checkType"]>("none");
  const [serviceTarget, setServiceTarget] = useState("");
  const [servicePort, setServicePort] = useState("443");
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<Subscription["type"]>("rss");
  const [subscriptionName, setSubscriptionName] = useState("");
  const [subscriptionUrl, setSubscriptionUrl] = useState("");
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(true);
  const [subscriptionInterval, setSubscriptionInterval] = useState("900");
  const [feedback, setFeedback] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
  const loginMutation = useMutation({ mutationFn: () => login(password), onSuccess: () => { setPassword(""); setLoginError(""); queryClient.invalidateQueries({ queryKey: ["session"] }); }, onError: (error: Error) => setLoginError(error.message || "登录失败") });
  const logoutMutation = useMutation({ mutationFn: logout, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session"] }) });
  const categoryMutation = useMutation({ mutationFn: () => editingCategory ? updateCategory(editingCategory.id, { name: categoryName, description: categoryDescription, icon: categoryIcon, iconKind: categoryIconKind, iconUrl: categoryIconUrl }) : createCategory({ name: categoryName, description: categoryDescription, icon: categoryIcon, iconKind: categoryIconKind, iconUrl: categoryIconUrl }), onSuccess: () => { setFeedback("分类已保存"); setEditingCategory(null); refresh(); }, onError: (error: Error) => setFeedback(error.message || "分类保存失败") });
  const categoryDelete = useMutation({ mutationFn: deleteCategory, onSuccess: () => { setFeedback("分类已删除"); refresh(); }, onError: (error: Error) => setFeedback(error.message || "删除失败") });
  const linkMutation = useMutation({ mutationFn: () => { const payload = { name: linkName, description: linkDescription, url: linkUrl, icon: linkIcon, iconKind: linkIconKind, iconUrl: linkIconUrl, categoryId: linkCategory, featured: editingLink?.featured ?? false, visible: editingLink?.visible ?? true, connectivityEnabled: linkConnectivity }; return editingLink ? updateLink(editingLink.id, payload) : createLink(payload); }, onSuccess: () => { setFeedback("链接已保存"); setEditingLink(null); refresh(); }, onError: (error: Error) => setFeedback(error.message || "链接保存失败") });
  const linkDelete = useMutation({ mutationFn: deleteLink, onSuccess: () => { setFeedback("链接已删除"); refresh(); }, onError: (error: Error) => setFeedback(error.message || "删除失败") });
  const serviceMutation = useMutation({ mutationFn: () => { const payload = { name: serviceName, enabled: serviceEnabled, checkType: serviceCheckType || "none", target: serviceTarget, port: Number(servicePort) || 0 }; return editingService ? updateService(editingService.id, payload) : createService(payload); }, onSuccess: () => { setFeedback("服务已保存"); setEditingService(null); refresh(); }, onError: (error: Error) => setFeedback(error.message || "服务保存失败") });
  const serviceDelete = useMutation({ mutationFn: deleteService, onSuccess: () => { setFeedback("服务已删除"); refresh(); }, onError: (error: Error) => setFeedback(error.message || "删除失败") });
  const serviceRefresh = useMutation({ mutationFn: refreshService, onSuccess: () => { setFeedback("服务状态已刷新"); refresh(); }, onError: (error: Error) => setFeedback(error.message || "服务刷新失败") });
  const subscriptionMutation = useMutation({ mutationFn: () => { const payload = { type: subscriptionType, name: subscriptionName, url: subscriptionUrl, enabled: subscriptionEnabled, intervalSeconds: Number(subscriptionInterval) || 900 }; return editingSubscription ? updateSubscription(editingSubscription.id, payload) : createSubscription(payload); }, onSuccess: () => { setFeedback("订阅已保存"); setEditingSubscription(null); refresh(); }, onError: (error: Error) => setFeedback(error.message || "订阅保存失败") });
  const subscriptionDelete = useMutation({ mutationFn: deleteSubscription, onSuccess: () => { setFeedback("订阅已删除"); refresh(); }, onError: (error: Error) => setFeedback(error.message || "删除失败") });
  const subscriptionRefresh = useMutation({ mutationFn: refreshSubscription, onSuccess: () => { setFeedback("订阅已刷新"); refresh(); }, onError: (error: Error) => setFeedback(error.message || "订阅刷新失败") });

  const startCategoryEdit = (category: Category) => { setEditingCategory(category); setCategoryName(category.name); setCategoryDescription(category.description); setCategoryIcon(category.icon); setCategoryIconKind(category.iconKind ?? "builtin"); setCategoryIconUrl(category.iconUrl ?? ""); setTab("categories"); };
  const startLinkEdit = (item: LinkItem) => { setEditingLink(item); setLinkName(item.name); setLinkDescription(item.description); setLinkUrl(item.url); setLinkIcon(item.icon); setLinkIconKind(item.iconKind ?? "builtin"); setLinkIconUrl(item.iconUrl ?? ""); setLinkConnectivity(item.connectivityEnabled !== false); setLinkCategory(item.categoryId); setTab("links"); };
  const startServiceEdit = (item: ServiceStatus) => { setEditingService(item); setServiceName(item.name); setServiceEnabled(item.enabled !== false); setServiceCheckType(item.checkType ?? "none"); setServiceTarget(item.target ?? ""); setServicePort(String(item.port ?? 443)); setTab("services"); };
  const startSubscriptionEdit = (item: Subscription) => { setEditingSubscription(item); setSubscriptionType(item.type); setSubscriptionName(item.name); setSubscriptionUrl(item.url); setSubscriptionEnabled(item.enabled); setSubscriptionInterval(String(item.intervalSeconds || 900)); setTab("subscriptions"); };

  return <main className="page-content admin-page">
    <div className="page-heading"><div><span className="eyebrow">管理控制台</span><h1>设置</h1><p>内容保存后立即生效；服务和订阅按配置刷新。</p></div><div className={`admin-status ${session.data?.authenticated ? "" : "is-locked"}`}>{session.data?.authenticated ? <><ShieldCheck size={16} /> 已登录</> : <><LogIn size={16} /> 需要登录</>}</div></div>
    {!session.data?.authenticated && <form className="admin-login" onSubmit={(event) => { event.preventDefault(); loginMutation.mutate(); }}><div><span className="eyebrow">管理员访问</span><h2>登录后编辑导航</h2><p>公开页面无需登录，只有保存配置时需要管理员会话。</p></div><div className="admin-login-fields"><label><span className="visually-hidden">管理员密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入管理员密码" autoComplete="current-password" /></label><button className="primary-button" type="submit" disabled={!password || loginMutation.isPending}><LogIn size={16} /> {loginMutation.isPending ? "登录中" : "登录"}</button></div>{loginError && <span className="login-error">{loginError}</span>}</form>}
    {session.data?.authenticated && <div className="admin-account-bar"><span><Check size={15} /> 当前会话有效，修改会直接写入 SQLite</span><button className="quiet-button" onClick={() => logoutMutation.mutate()}><LogOut size={15} /> 退出</button></div>}
    {session.data?.authenticated && <div className="admin-tabs" role="tablist"><button className={tab === "categories" ? "active" : ""} onClick={() => setTab("categories")}><LayoutGrid size={16} /> 分类</button><button className={tab === "links" ? "active" : ""} onClick={() => setTab("links")}><Link2 size={16} /> 链接</button><button className={tab === "services" ? "active" : ""} onClick={() => setTab("services")}><Activity size={16} /> 服务状态</button><button className={tab === "subscriptions" ? "active" : ""} onClick={() => setTab("subscriptions")}><Rss size={16} /> 动态订阅</button><button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}><SlidersHorizontal size={16} /> 外观</button></div>}
    {feedback && <div className="feedback-banner"><Check size={16} /> {feedback}<button onClick={() => setFeedback("")} aria-label="关闭提示"><X size={15} /></button></div>}
    {session.data?.authenticated && tab === "categories" && <div className="admin-grid"><section className="admin-section"><div className="section-title"><div><span className="eyebrow">目录结构</span><h2>收藏夹</h2></div><button className="primary-button" onClick={() => { setEditingCategory(null); setCategoryName(""); setCategoryDescription(""); setCategoryIcon("folder"); setCategoryIconKind("builtin"); setCategoryIconUrl(""); }}><Plus size={16} /> 新增收藏夹</button></div><div className="admin-list">{data.categories.map((category) => <div className="admin-list-row" key={category.id}><span className="admin-drag">⋮⋮</span><span className="admin-item-icon"><ItemIcon icon={category.icon} iconKind={category.iconKind} iconUrl={category.iconUrl} size={18} /></span><span className="admin-item-copy"><strong>{category.name}</strong><small>{category.description} · {category.links.length} 个链接</small></span><button className="icon-button subtle" onClick={() => startCategoryEdit(category)} title="编辑收藏夹"><Edit3 size={16} /></button><button className="icon-button subtle danger" onClick={() => categoryDelete.mutate(category.id)} title="删除收藏夹"><Trash2 size={16} /></button></div>)}</div></section><CategoryForm editing={editingCategory} name={categoryName} description={categoryDescription} icon={categoryIcon} iconKind={categoryIconKind} iconUrl={categoryIconUrl} setName={setCategoryName} setDescription={setCategoryDescription} setIcon={setCategoryIcon} setIconKind={setCategoryIconKind} setIconUrl={setCategoryIconUrl} onSubmit={() => categoryMutation.mutate()} onCancel={() => setEditingCategory(null)} /></div>}
    {session.data?.authenticated && tab === "links" && <div className="admin-grid"><section className="admin-section"><div className="section-title"><div><span className="eyebrow">链接目录</span><h2>全部链接</h2></div><button className="primary-button" onClick={() => { setEditingLink(null); setLinkName(""); setLinkDescription(""); setLinkUrl(""); setLinkIcon("globe"); setLinkIconKind("builtin"); setLinkIconUrl(""); setLinkConnectivity(true); }}><Plus size={16} /> 新增链接</button></div><div className="admin-list">{data.categories.flatMap((category) => category.links.map((item) => ({ item, category }))).map(({ item, category }) => <div className="admin-list-row" key={item.id}><span className="admin-item-icon"><ItemIcon icon={item.icon} iconKind={item.iconKind} iconUrl={item.iconUrl} size={18} /></span><span className="admin-item-copy"><strong>{item.name}</strong><small>{category.name} · {item.url}</small></span><button className="icon-button subtle" onClick={() => startLinkEdit(item)} title="编辑链接"><Edit3 size={16} /></button><button className="icon-button subtle danger" onClick={() => linkDelete.mutate(item.id)} title="删除链接"><Trash2 size={16} /></button></div>)}</div></section><LinkForm editing={editingLink} name={linkName} description={linkDescription} url={linkUrl} icon={linkIcon} iconKind={linkIconKind} iconUrl={linkIconUrl} connectivityEnabled={linkConnectivity} categoryId={linkCategory} categories={data.categories} setName={setLinkName} setDescription={setLinkDescription} setUrl={setLinkUrl} setIcon={setLinkIcon} setIconKind={setLinkIconKind} setIconUrl={setLinkIconUrl} setConnectivityEnabled={setLinkConnectivity} setCategoryId={setLinkCategory} onSubmit={() => linkMutation.mutate()} onCancel={() => setEditingLink(null)} /></div>}
    {session.data?.authenticated && tab === "services" && <div className="admin-grid"><section className="admin-section"><div className="section-title"><div><span className="eyebrow">关注清单</span><h2>服务状态</h2></div><button className="primary-button" onClick={() => { setEditingService(null); setServiceName(""); setServiceEnabled(true); setServiceCheckType("none"); setServiceTarget(""); setServicePort("443"); }}><Plus size={16} /> 新增服务</button></div><div className="admin-list">{data.services.map((item) => <div className="admin-list-row" key={item.id}><span className={`status-dot ${item.status}`} /><span className="admin-item-copy"><strong>{item.name}</strong><small>{item.checkType === "none" ? "未配置检查" : `${(item.checkType ?? "none").toUpperCase()} · ${item.target || ""}${item.port ? `:${item.port}` : ""}`} · {item.status === "online" ? "正常" : item.status === "degraded" ? "异常" : item.status === "offline" ? "离线" : "待检查"}</small></span><button className="icon-button subtle" onClick={() => serviceRefresh.mutate(item.id)} title="刷新服务状态"><RefreshCw size={16} /></button><button className="icon-button subtle" onClick={() => startServiceEdit(item)} title="编辑服务"><Edit3 size={16} /></button><button className="icon-button subtle danger" onClick={() => serviceDelete.mutate(item.id)} title="删除服务"><Trash2 size={16} /></button></div>)}</div></section><ServiceForm editing={editingService} name={serviceName} enabled={serviceEnabled} checkType={serviceCheckType ?? "none"} target={serviceTarget} port={servicePort} setName={setServiceName} setEnabled={setServiceEnabled} setCheckType={setServiceCheckType} setTarget={setServiceTarget} setPort={setServicePort} onSubmit={() => serviceMutation.mutate()} onCancel={() => setEditingService(null)} /></div>}
    {session.data?.authenticated && tab === "subscriptions" && <div className="admin-grid"><section className="admin-section"><div className="section-title"><div><span className="eyebrow">关注内容</span><h2>动态订阅</h2></div><button className="primary-button" onClick={() => { setEditingSubscription(null); setSubscriptionType("rss"); setSubscriptionName(""); setSubscriptionUrl(""); setSubscriptionEnabled(true); setSubscriptionInterval("900"); }}><Plus size={16} /> 新增订阅</button></div><div className="admin-list">{(data.subscriptions ?? []).map((item) => <div className="admin-list-row" key={item.id}><span className={`source-dot ${item.type}`} /><span className="admin-item-copy"><strong>{item.name}</strong><small>{item.type.toUpperCase()} · {item.itemCount ?? 0} 条缓存{item.lastError ? ` · ${item.lastError}` : ""}</small></span><button className="icon-button subtle" onClick={() => subscriptionRefresh.mutate(item.id)} title="刷新订阅"><RefreshCw size={16} /></button><button className="icon-button subtle" onClick={() => startSubscriptionEdit(item)} title="编辑订阅"><Edit3 size={16} /></button><button className="icon-button subtle danger" onClick={() => subscriptionDelete.mutate(item.id)} title="删除订阅"><Trash2 size={16} /></button></div>)}</div></section><SubscriptionForm editing={editingSubscription} type={subscriptionType} name={subscriptionName} url={subscriptionUrl} enabled={subscriptionEnabled} interval={subscriptionInterval} setType={setSubscriptionType} setName={setSubscriptionName} setUrl={setSubscriptionUrl} setEnabled={setSubscriptionEnabled} setInterval={setSubscriptionInterval} onSubmit={() => subscriptionMutation.mutate()} onCancel={() => setEditingSubscription(null)} /></div>}
    {session.data?.authenticated && tab === "settings" && <SettingsPanel data={data} />}
  </main>;
}

function IconFields({ icon, iconKind, iconUrl, setIcon, setIconKind, setIconUrl }: { icon: string; iconKind: "builtin" | "url"; iconUrl: string; setIcon: (value: string) => void; setIconKind: (value: "builtin" | "url") => void; setIconUrl: (value: string) => void }) {
  return <div className="icon-fields"><label>图标来源<select value={iconKind} onChange={(event) => setIconKind(event.target.value as "builtin" | "url")}><option value="builtin">内置图标</option><option value="url">图片地址</option></select></label>{iconKind === "builtin" ? <label>内置图标<select value={icon} onChange={(event) => setIcon(event.target.value)}>{iconOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> : <label>图片地址<input value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} placeholder="https://..." inputMode="url" /></label>}<span className="icon-preview"><ItemIcon icon={icon} iconKind={iconKind} iconUrl={iconUrl} size={20} /></span></div>;
}

function CategoryForm({ editing, name, description, icon, iconKind, iconUrl, setName, setDescription, setIcon, setIconKind, setIconUrl, onSubmit, onCancel }: { editing: Category | null; name: string; description: string; icon: string; iconKind: "builtin" | "url"; iconUrl: string; setName: (value: string) => void; setDescription: (value: string) => void; setIcon: (value: string) => void; setIconKind: (value: "builtin" | "url") => void; setIconUrl: (value: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return <section className="editor-panel"><div className="section-title"><div><span className="eyebrow">{editing ? "编辑收藏夹" : "新建收藏夹"}</span><h2>{editing ? editing.name : "添加一个收藏夹"}</h2></div></div><label>名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：设计资源" /></label><label>描述<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="一句话说明这个收藏夹" /></label><IconFields icon={icon} iconKind={iconKind} iconUrl={iconUrl} setIcon={setIcon} setIconKind={setIconKind} setIconUrl={setIconUrl} /><div className="form-actions"><button className="quiet-button" onClick={onCancel}>取消</button><button className="primary-button" onClick={onSubmit} disabled={!name.trim()}><Check size={16} /> 保存收藏夹</button></div></section>;
}

function LinkForm({ editing, name, description, url, icon, iconKind, iconUrl, connectivityEnabled, categoryId, categories, setName, setDescription, setUrl, setIcon, setIconKind, setIconUrl, setConnectivityEnabled, setCategoryId, onSubmit, onCancel }: { editing: LinkItem | null; name: string; description: string; url: string; icon: string; iconKind: "builtin" | "url"; iconUrl: string; connectivityEnabled: boolean; categoryId: number; categories: Category[]; setName: (value: string) => void; setDescription: (value: string) => void; setUrl: (value: string) => void; setIcon: (value: string) => void; setIconKind: (value: "builtin" | "url") => void; setIconUrl: (value: string) => void; setConnectivityEnabled: (value: boolean) => void; setCategoryId: (value: number) => void; onSubmit: () => void; onCancel: () => void }) {
  return <section className="editor-panel"><div className="section-title"><div><span className="eyebrow">{editing ? "编辑链接" : "新建链接"}</span><h2>{editing ? editing.name : "添加一个链接"}</h2></div></div><label>名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：Notion" /></label><label>描述<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="简短的用途描述" /></label><label>地址<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" inputMode="url" /></label><label>所属分类<select value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><IconFields icon={icon} iconKind={iconKind} iconUrl={iconUrl} setIcon={setIcon} setIconKind={setIconKind} setIconUrl={setIconUrl} /><label className="checkbox-row"><input type="checkbox" checked={connectivityEnabled} onChange={(event) => setConnectivityEnabled(event.target.checked)} /> 在主页显示本机连通性</label><div className="form-actions"><button className="quiet-button" onClick={onCancel}>取消</button><button className="primary-button" onClick={onSubmit} disabled={!name.trim() || !url.trim()}><Check size={16} /> 保存链接</button></div></section>;
}

function ServiceForm({ editing, name, enabled, checkType, target, port, setName, setEnabled, setCheckType, setTarget, setPort, onSubmit, onCancel }: { editing: ServiceStatus | null; name: string; enabled: boolean; checkType: "none" | "http" | "tcp"; target: string; port: string; setName: (value: string) => void; setEnabled: (value: boolean) => void; setCheckType: (value: ServiceStatus["checkType"]) => void; setTarget: (value: string) => void; setPort: (value: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return <section className="editor-panel"><div className="section-title"><div><span className="eyebrow">{editing ? "编辑服务" : "新建服务"}</span><h2>{editing ? editing.name : "添加关注服务"}</h2></div></div><label>名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：GitHub" /></label><label>检查方式<select value={checkType} onChange={(event) => setCheckType(event.target.value as ServiceStatus["checkType"])}><option value="none">仅手动记录</option><option value="http">HTTP 健康检查</option><option value="tcp">TCP 建连检查</option></select></label>{checkType !== "none" && <label>{checkType === "http" ? "健康地址" : "主机名"}<input value={target} onChange={(event) => setTarget(event.target.value)} placeholder={checkType === "http" ? "https://status.example.com/health" : "example.com"} /></label>}{checkType === "tcp" && <label>端口<input value={port} onChange={(event) => setPort(event.target.value)} inputMode="numeric" /></label>}<label className="checkbox-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> 在主页关注此服务</label><div className="form-actions"><button className="quiet-button" onClick={onCancel}>取消</button><button className="primary-button" onClick={onSubmit} disabled={!name.trim()}><Check size={16} /> 保存服务</button></div></section>;
}

function SubscriptionForm({ editing, type, name, url, enabled, interval, setType, setName, setUrl, setEnabled, setInterval, onSubmit, onCancel }: { editing: Subscription | null; type: Subscription["type"]; name: string; url: string; enabled: boolean; interval: string; setType: (value: Subscription["type"]) => void; setName: (value: string) => void; setUrl: (value: string) => void; setEnabled: (value: boolean) => void; setInterval: (value: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return <section className="editor-panel"><div className="section-title"><div><span className="eyebrow">{editing ? "编辑订阅" : "新建订阅"}</span><h2>{editing ? editing.name : "添加关注内容"}</h2></div></div><label>类型<select value={type} onChange={(event) => setType(event.target.value as Subscription["type"])}><option value="rss">RSS / Atom</option><option value="github">GitHub Releases</option><option value="youtube">YouTube 频道</option></select></label><label>名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：少数派" /></label><label>{type === "github" ? "仓库（owner/repo）" : "Feed 地址"}<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={type === "github" ? "facebook/react" : "https://example.com/feed.xml"} inputMode="url" /></label><label>刷新间隔（秒）<input value={interval} onChange={(event) => setInterval(event.target.value)} inputMode="numeric" /></label><label className="checkbox-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> 在最近动态中显示</label><div className="form-actions"><button className="quiet-button" onClick={onCancel}>取消</button><button className="primary-button" onClick={onSubmit} disabled={!name.trim() || !url.trim()}><Check size={16} /> 保存订阅</button></div></section>;
}

function SettingsPanel({ data }: { data: BootstrapData }) {
  const queryClient = useQueryClient();
  const [brandName, setBrandName] = useState(data.brand.name);
  const [brandDescription, setBrandDescription] = useState(data.brand.description);
  const [defaultEngine, setDefaultEngine] = useState(data.settings.defaultEngine);
  const [weatherLocation, setWeatherLocation] = useState(data.settings.weatherLocation);
  const [timezone, setTimezone] = useState(data.settings.timezone);
  const appearance = data.settings.appearance ?? { theme: "system", clockStyle: "plain", clock24Hour: true, clockSeconds: false, clockColor: "#2f6ff3", clockSpeed: 1 };
  const [themeDefault, setThemeDefault] = useState<Theme>(appearance.theme);
  const [clockStyle, setClockStyle] = useState<AppearanceSettings["clockStyle"]>(appearance.clockStyle);
  const [clock24Hour, setClock24Hour] = useState(appearance.clock24Hour);
  const [clockSeconds, setClockSeconds] = useState(appearance.clockSeconds);
  const [clockColor, setClockColor] = useState(appearance.clockColor);
  const [clockSpeed, setClockSpeed] = useState(String(appearance.clockSpeed || 1));
  const [saveError, setSaveError] = useState("");
  const mutation = useMutation({
    mutationFn: () => updateSettings({ brandName, brandDescription, defaultEngine, weatherLocation, timezone, theme: themeDefault, clockStyle, clock24Hour, clockSeconds, clockColor, clockSpeed: Number(clockSpeed) || 1 }),
    onSuccess: () => { setSaveError(""); queryClient.invalidateQueries({ queryKey: ["bootstrap"] }); },
    onError: (error: Error) => setSaveError(error.message || "保存设置失败"),
  });
  return <section className="settings-form"><div className="section-title"><div><span className="eyebrow">站点偏好</span><h2>外观与默认值</h2></div><button className="primary-button" onClick={() => mutation.mutate()} disabled={mutation.isPending}><Check size={16} /> {mutation.isPending ? "保存中" : "保存设置"}</button></div><div className="settings-grid"><label>站点名称<input value={brandName} onChange={(event) => setBrandName(event.target.value)} /></label><label>默认搜索引擎<select value={defaultEngine} onChange={(event) => setDefaultEngine(event.target.value)}>{engineOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>天气城市<input value={weatherLocation} onChange={(event) => setWeatherLocation(event.target.value)} /></label><label>默认时区<input value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label><label className="settings-wide">站点说明<input value={brandDescription} onChange={(event) => setBrandDescription(event.target.value)} placeholder="可留空" /></label><label>主题默认值<select value={themeDefault} onChange={(event) => setThemeDefault(event.target.value as Theme)}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label><label>时钟样式<select value={clockStyle} onChange={(event) => setClockStyle(event.target.value as AppearanceSettings["clockStyle"])}>{clockStyles.map((style) => <option key={style} value={style}>{style === "plain" ? "标准" : style === "flip" ? "翻页" : style === "ticker" ? "滚动" : "柔和发光"}</option>)}</select></label><label className="checkbox-row"><input type="checkbox" checked={clock24Hour} onChange={(event) => setClock24Hour(event.target.checked)} /> 24 小时制</label><label className="checkbox-row"><input type="checkbox" checked={clockSeconds} onChange={(event) => setClockSeconds(event.target.checked)} /> 显示秒数</label><label>时钟颜色<input type="color" value={clockColor} onChange={(event) => setClockColor(event.target.value)} /></label><label>动画速度<input type="number" min="1" max="3" value={clockSpeed} onChange={(event) => setClockSpeed(event.target.value)} /></label></div>{saveError && <p className="settings-error">{saveError}</p>}<div className="settings-note"><CircleHelp size={17} /><span>主页主题按钮按“跟随系统 → 浅色 → 深色”循环；时钟效果只影响顶部显示；时区请填写 IANA 名称，例如 Asia/Shanghai。</span></div></section>;
}

export { App };
