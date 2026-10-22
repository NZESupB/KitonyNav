import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import { Dialog, DropdownMenu, Popover, Tabs } from "radix-ui";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import {
  Activity, ArrowUpRight, Check, ChevronDown, ChevronRight, CircleAlert, CircleHelp,
  CloudSun, Clock3, Command, Edit3, Globe2, House, LayoutGrid, Link2, LogIn, LogOut,
  Menu, MessageCircle, Moon, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus,
  RefreshCw, Rss, Search, Settings2, ShieldCheck, SlidersHorizontal, Sun, Trash2, Wifi, X,
} from "lucide-react";
import { ItemIcon, iconOptions } from "./components/icons/ItemIcon";
import { useMediaQuery } from "./hooks/use-media-query";
import { UI_STORAGE_KEY, useUIStore, type Theme } from "./stores/ui-store";
import { useSaveMutation } from "./hooks/use-save-mutation";
import { usePageVisible } from "./hooks/use-page-visible";
import { ClockDisplay } from "./components/ClockDisplay";
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

import { linkProbeTargets, serviceProbeTargets, useBrowserConnectivity, useLocalProbeConnectivity, type ConnectivityResult } from "./hooks/use-connectivity";
import { fetchVisitorGeo, isPublicAddress, publicStunAddress, type VisitorGeo } from "./lib/network";

const clockStyles: Array<AppearanceSettings["clockStyle"]> = ["plain", "flip", "ticker", "glow"];


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
  const visible = usePageVisible();
  useEffect(() => {
    if (!visible) return;
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [visible]);
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


function themeLabel(theme: Theme) {
  return theme === "system" ? "跟随系统" : theme === "light" ? "浅色模式" : "深色模式";
}


function App() {
  return <MotionConfig reducedMotion="user"><AppShell /></MotionConfig>;
}

function AppShell() {
  const { data, isFetching, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["bootstrap"], queryFn: ({ signal }) => fetchBootstrap(signal),
    staleTime: 30_000, refetchInterval: 60_000, refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const themeOverride = useUIStore((state) => state.theme);
  const collapsed = useUIStore((state) => state.collapsed);
  const mobileMenuOpen = useUIStore((state) => state.mobileMenuOpen);
  const setMobileMenuOpen = useUIStore((state) => state.setMobileMenuOpen);
  const isMobile = useMediaQuery("(max-width: 980px)");
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const reducedMotion = useReducedMotion();
  const theme = themeOverride ?? data?.settings.appearance?.theme ?? "system";
  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const appData = useMemo(() => data ? normalizeBootstrap(data) : undefined, [data]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolvedTheme === "dark" ? "#11151c" : "#edf1f7");
  }, [resolvedTheme]);

  useEffect(() => {
    document.title = data?.brand.name || "KitonyNav";
  }, [data?.brand.name]);

  useEffect(() => {
    const syncPreferences = (event: StorageEvent) => {
      if (event.key === UI_STORAGE_KEY || event.key === null) void useUIStore.persist.rehydrate();
    };
    window.addEventListener("storage", syncPreferences);
    return () => window.removeEventListener("storage", syncPreferences);
  }, []);

  useEffect(() => {
    if (!isMobile && useUIStore.getState().mobileMenuOpen) setMobileMenuOpen(false);
  }, [isMobile, setMobileMenuOpen]);

  if (!appData) {
    return error ? (
      <main className="app-loading" role="alert">
        <div><h1>导航加载失败</h1><p>{error.message}</p>
          <button className="primary-button" disabled={isFetching} onClick={() => void refetch()}>{isFetching ? "重试中" : "重新加载"}</button>
        </div>
      </main>
    ) : <div className="app-loading"><div className="loading-orb" /><span>准备你的导航空间</span></div>;
  }

  return (
    <Dialog.Root open={isMobile && mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
        {isMobile ? (
          <Dialog.Portal>
            <Dialog.Overlay className="mobile-scrim" />
            <Dialog.Content asChild>
              <motion.aside className={`sidebar mobile-sidebar ${collapsed ? "sidebar-collapsed" : ""}`} initial={false} animate={{ width: collapsed ? 80 : 252 }} transition={reducedMotion ? { duration: 0 } : sidebarTransition}>
                <Dialog.Title className="visually-hidden">导航菜单</Dialog.Title>
                <Dialog.Description className="visually-hidden">选择页面或收藏夹，按 Escape 关闭导航。</Dialog.Description>
                <Sidebar data={appData} mobile />
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        ) : (
          <motion.aside className="sidebar" initial={false} animate={{ width: collapsed ? 80 : 252 }} transition={reducedMotion ? { duration: 0 } : sidebarTransition}>
            <Sidebar data={appData} />
          </motion.aside>
        )}
        <div className="workspace">
          <TopBar data={appData} resolvedTheme={resolvedTheme} />
          {error && <div className="feedback-banner error" role="alert"><CircleAlert size={16} /><span>同步失败，正在显示上次成功的数据：{error.message}</span><button disabled={isFetching} onClick={() => void refetch()} aria-label="重试同步"><RefreshCw size={16} /></button></div>}
          <Routes>
            <Route path="/" element={<HomePage data={appData} isFetching={isFetching} syncError={!!error} syncedAt={dataUpdatedAt} />} />
            <Route path="/updates" element={<UpdatesPage data={appData} />} />
            <Route path="/admin" element={<AdminPage data={appData} />} />
            <Route path="*" element={<HomePage data={appData} isFetching={isFetching} syncError={!!error} syncedAt={dataUpdatedAt} />} />
          </Routes>
        </div>
      </div>
    </Dialog.Root>
  );
}

const sidebarTransition = {
  duration: 0.28,
  ease: [0.2, 0.8, 0.2, 1] as const,
};

const labelTransition = (collapsed: boolean, delay = 0, reducedMotion = false) => ({
  duration: reducedMotion ? 0 : collapsed ? 0.12 : 0.22,
  delay: reducedMotion || collapsed ? 0 : 0.04 + delay,
  ease: collapsed ? ("easeIn" as const) : ([0.16, 1, 0.3, 1] as const),
});

const labelAnim = (collapsed: boolean) => ({
  opacity: collapsed ? 0 : 1,
  x: collapsed ? -8 : 0,
  width: collapsed ? 0 : ("auto" as const),
  marginLeft: collapsed ? 0 : 10,
});

function Sidebar({ data, mobile = false }: { data: BootstrapData; mobile?: boolean }) {
  const collapsed = useUIStore((state) => state.collapsed);
  const setCollapsed = useUIStore((state) => state.setCollapsed);
  const activeCategory = useUIStore((state) => state.activeCategory);
  const setActiveCategory = useUIStore((state) => state.setActiveCategory);
  const setMobileMenuOpen = useUIStore((state) => state.setMobileMenuOpen);
  const navigate = useNavigate();
  const reducedMotion = !!useReducedMotion();
  return (
    <div className="sidebar-inner">
          <div className="brand-lockup">
            <div className="sidebar-icon-slot">
              <div className="brand-mark"><img src="/favicon.svg" alt="" width="34" height="34" /></div>
            </div>
            <motion.div
              className="sidebar-text-slot"
              initial={false}
              animate={labelAnim(collapsed)}
              transition={labelTransition(collapsed, 0, reducedMotion)}
            >
              <div className="brand-name">{data.brand.name || "KitonyNav"}</div>
            </motion.div>
          </div>
          {mobile && <Dialog.Close asChild><button className="mobile-close icon-button" aria-label="关闭导航"><X size={20} /></button></Dialog.Close>}
          <nav className="primary-nav" aria-label="主导航">
            <NavItem to="/" icon={<House size={19} />} label="首页" collapsed={collapsed} exact index={0} />
            <NavItem to="/updates" icon={<MessageCircle size={19} />} label="动态" collapsed={collapsed} index={1} />
            <NavItem to="/admin" icon={<Settings2 size={19} />} label="设置" collapsed={collapsed} index={2} />
          </nav>
          <div className="sidebar-rule" />
          <motion.div
            className="sidebar-section-heading"
            inert={collapsed || undefined}
            initial={false}
            animate={{
              opacity: collapsed ? 0 : 1,
              height: collapsed ? 0 : 28,
              minHeight: collapsed ? 0 : 28,
              marginBottom: collapsed ? 0 : 6,
            }}
            transition={{
              duration: reducedMotion ? 0 : collapsed ? 0.12 : 0.22,
              delay: reducedMotion || collapsed ? 0 : 0.05,
              ease: collapsed ? "easeIn" : [0.16, 1, 0.3, 1],
            }}
            style={{ overflow: "hidden" }}
          >
            <span>收藏夹</span>
            <NavLink to="/admin" className="icon-button subtle" title="添加收藏夹" aria-label="添加收藏夹" onClick={() => setMobileMenuOpen(false)}><Plus size={17} /></NavLink>
          </motion.div>
          <div className="sidebar-folders">
            {data.categories.map((category, index) => {
              const isSelected = activeCategory === category.id;
              return (
                <button
                  className={`folder-row ${isSelected ? "selected" : ""}`}
                  key={category.id}
                  onClick={() => { setActiveCategory(isSelected ? null : category.id); setMobileMenuOpen(false); navigate("/"); }}
                  aria-label={category.name}
                  aria-pressed={isSelected}
                  title={collapsed ? category.name : undefined}
                >
                  {isSelected && (
                    <motion.span
                      layout="position"
                      layoutId="sidebar-folder-active-pill"
                      className="nav-pill-active"
                      transition={{ type: "spring", bounce: 0.12, duration: 0.32 }}
                    />
                  )}
                  <span className="sidebar-icon-slot">
                    <ItemIcon icon={category.icon} iconKind={category.iconKind} iconUrl={category.iconUrl} size={18} />
                  </span>
                  <motion.div
                    className="sidebar-text-slot"
                    initial={false}
                    animate={labelAnim(collapsed)}
                    transition={labelTransition(collapsed, 0.05 + index * 0.015, reducedMotion)}
                  >
                    <div className="folder-text-content">
                      <span className="folder-name">{category.name}{category.name === "常用" ? "网站" : ""}</span>
                      <span className="folder-count">{category.links.length}</span>
                    </div>
                  </motion.div>
                </button>
              );
            })}
          </div>
          <div className="sidebar-spacer" />
          <div className="sidebar-footer">
            <button
              className="collapse-row nav-row"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "展开侧栏" : "收起侧栏"}
              aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
            >
              <span className="sidebar-icon-slot">
                {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </span>
              <motion.span
                className="sidebar-text-slot nav-row-label"
                initial={false}
                animate={labelAnim(collapsed)}
                transition={labelTransition(collapsed, 0.1, reducedMotion)}
              >
                收起侧栏
              </motion.span>
            </button>
          </div>
        </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  collapsed,
  exact,
  index = 0,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  exact?: boolean;
  index?: number;
}) {
  const setMobileMenuOpen = useUIStore((state) => state.setMobileMenuOpen);
  const reducedMotion = !!useReducedMotion();
  return (
    <NavLink to={to} end={exact} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `nav-row ${isActive ? "active" : ""}`} title={collapsed ? label : undefined}>
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layout="position"
              layoutId="sidebar-nav-active-pill"
              className="nav-pill-active"
              transition={{ type: "spring", bounce: 0.12, duration: 0.32 }}
            />
          )}
          <span className="sidebar-icon-slot">{icon}</span>
          <motion.span
            className="sidebar-text-slot nav-row-label"
            initial={false}
            animate={labelAnim(collapsed)}
            transition={labelTransition(collapsed, 0.02 + index * 0.02, reducedMotion)}
          >
            {label}
          </motion.span>
        </>
      )}
    </NavLink>
  );
}

function TopBar({ data, resolvedTheme }: { data: BootstrapData; resolvedTheme: "light" | "dark" }) {
  const now = useClock();
  const appearance = data.settings.appearance ?? { theme: "system", clockStyle: "plain", clock24Hour: true, clockSeconds: false, clockColor: "#2f6ff3", clockSpeed: 1 };
  const timezone = useMemo(() => safeTimezone(data.settings.timezone), [data.settings.timezone]);
  const { time, date } = formatClock(now, timezone, appearance);
  const clockClass = `clock-${appearance.clockStyle}`;
  const theme = useUIStore((state) => state.theme) ?? appearance.theme;
  const setTheme = useUIStore((state) => state.setTheme);
  return (
    <header className="topbar">
      <Dialog.Trigger asChild><button className="mobile-menu-button icon-button" aria-label="打开导航"><Menu size={20} /></button></Dialog.Trigger>
      <div className="topbar-meta">
        <span className="weather-inline"><CloudSun size={19} /><span>{data.settings.weatherLocation}</span><strong>24°C</strong><em>多云</em></span>
        <span className="topbar-divider" />
        <span className={`time-inline ${clockClass}`} style={{ "--clock-color": appearance.clockColor } as CSSProperties}><Clock3 size={18} /><ClockDisplay time={time} appearance={appearance} /><span>{date}</span></span>
        <span className="topbar-divider" />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="topbar-theme" aria-label={`主题设置，当前${themeLabel(theme)}`} title="选择主题">{resolvedTheme === "dark" ? <Moon size={18} /> : <Sun size={18} />}<span>{themeLabel(theme)}</span><ChevronDown size={15} /></button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="theme-menu" align="end" sideOffset={8} collisionPadding={12}>
              <DropdownMenu.RadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)} aria-label="选择主题">
                {(["system", "light", "dark"] as const).map((value) => (
                  <DropdownMenu.RadioItem className="theme-menu-item" value={value} key={value}>
                    <span>{themeLabel(value)}</span><DropdownMenu.ItemIndicator><Check size={15} /></DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

function HomePage({ data, isFetching, syncError, syncedAt }: { data: BootstrapData; isFetching: boolean; syncError: boolean; syncedAt: number }) {
  const selectedCategory = useUIStore((state) => state.activeCategory);
  const activeCategory = data.categories.some((category) => category.visible !== false && category.id === selectedCategory) ? selectedCategory : null;
  const setActiveCategory = useUIStore((state) => state.setActiveCategory);
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState(() => resolveEngine(data.settings.defaultEngine));
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectedCategory !== activeCategory) setActiveCategory(activeCategory);
  }, [selectedCategory, activeCategory, setActiveCategory]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (event.key === "/" && document.activeElement !== searchInputRef.current) {
        const target = event.target as HTMLElement | null;
        if (target?.tagName !== "INPUT" && target?.tagName !== "TEXTAREA" && !target?.isContentEditable) {
          event.preventDefault();
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const visibleLinks = useMemo(() => data.categories.filter((category) => category.visible !== false).flatMap((category) => category.links.filter((item) => item.visible !== false)), [data.categories]);
  const browserConnectivity = useBrowserConnectivity(visibleLinks);
  const linkTargets = useMemo(() => linkProbeTargets(visibleLinks), [visibleLinks]);
  const serviceTargets = useMemo(() => serviceProbeTargets(data.services), [data.services]);
  const linkProbeConnectivity = useLocalProbeConnectivity(linkTargets);
  const serviceConnectivity = useLocalProbeConnectivity(serviceTargets);
  const connectivity = Object.fromEntries(visibleLinks.map((link) => {
    const probe = linkProbeConnectivity[link.id];
    return [link.id, probe?.state === "reachable" || probe?.state === "unreachable" ? probe : browserConnectivity[link.id]];
  }));

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
    <motion.main className="home-layout route-page-container" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
      <div className="home-main">
        <div className="search-wrap">
          <div className={`search-box ${query ? "has-value" : ""}`}>
            <Search size={22} strokeWidth={1.7} />
            <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) openSearch(); }} placeholder="搜索或输入网址 (⌘K)" aria-label="搜索或输入网址" />
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
            <button className="bang-hint" onClick={() => setQuery("!bd ")}>!bd</button><button className="bang-hint" onClick={() => setQuery("!yt ")}>!yt</button><button className="bang-hint" onClick={() => setQuery("!st ")}>!st</button>
          </div>
        </div>

        <div className={`home-content-header ${query ? "" : "compact"}`}>
          <div>{query && <><span className="eyebrow">搜索结果 · {visibleCategories.reduce((count, item) => count + item.links.length, 0)} 个链接</span><h1>找到你要去的地方</h1></>}</div>
          <div className="header-actions"><button className="quiet-button" onClick={() => navigate("/admin")}><SlidersHorizontal size={16} /> 管理内容</button></div>
        </div>

        <div className="directory-list">
          {query && visibleCategories.length === 0 ? (
            <div className="empty-search-state">
              <div className="empty-search-icon"><Search size={22} /></div>
              <h3>未找到与“{query}”相关的链接</h3>
              <p>可以尝试更换搜索关键词，或直接点击下方按钮使用外部引擎搜索</p>
              <div className="empty-search-actions">
                <button className="quiet-button" onClick={() => setQuery("")}>清空输入</button>
                <button className="primary-button" onClick={openSearch}>使用 {engine} 搜索</button>
              </div>
            </div>
          ) : visibleCategories.length === 0 ? (
            <div className="empty-search-state" role="status"><h3>暂无可显示的链接</h3><p>可以切换收藏夹，或在设置中添加链接。</p><button className="quiet-button" onClick={() => { setActiveCategory(null); navigate("/admin"); }}>管理内容</button></div>
          ) : (
            visibleCategories.slice(0, query || activeCategory !== null || showAll ? undefined : 3).map((category) => (
              <CategorySection category={category} expanded={!!query.trim() || activeCategory !== null} connectivity={connectivity} key={category.id} onMore={() => setActiveCategory(category.id)} />
            ))
          )}
        </div>

        {!query && activeCategory === null && visibleCategories.length > 3 && <button className="show-more-button" onClick={() => setShowAll(!showAll)}>{showAll ? "收起分类" : "查看全部分类"}<ChevronDown size={16} className={showAll ? "rotated" : ""} /></button>}

        <div className="bottom-panels">
          <StatusPanel services={data.services} compact localConnectivity={serviceConnectivity} />
          <UpdatesPanel updates={data.updates} compact />
        </div>
        <NetworkPanel />
        <div className="sync-banner"><div className="sync-icon"><Activity size={17} /></div><div><strong>{isFetching ? "正在同步" : syncError ? "同步失败，保留上次内容" : "已读取最新缓存"}</strong><span>页面可见时每 60 秒同步服务与订阅缓存。</span></div><time className="sync-time" dateTime={new Date(syncedAt).toISOString()}>上次同步 {new Date(syncedAt).toLocaleTimeString("zh-CN")}</time></div>
      </div>
      <aside className="home-rail">
        <StatusPanel services={data.services} localConnectivity={serviceConnectivity} />
        <UpdatesPanel updates={data.updates} />
      </aside>
    </motion.main>
  );
}

function CategorySection({ category, connectivity, onMore, expanded = false }: { category: Category; connectivity: Record<number, ConnectivityResult | undefined>; onMore: () => void; expanded?: boolean }) {
  return (
    <section className="category-section">
      <div className="category-heading"><div className="category-title"><span className="category-icon"><ItemIcon icon={category.icon} iconKind={category.iconKind} iconUrl={category.iconUrl} size={21} /></span><div><h2>{category.name}</h2><p>{category.description}</p></div></div><button className="category-more" onClick={onMore} aria-label={`查看${category.name}全部链接`}><ChevronRight size={19} /></button></div>
      <div className="link-grid">
        {(expanded ? category.links : category.links.slice(0, 8)).map((item) => <LinkItemCard item={item} connectivity={connectivity[item.id]} key={item.id} />)}
        {!expanded && category.links.length > 8 && <button className="link-card more-card" onClick={onMore}><span><MoreHorizontal size={20} /></span><div><strong>更多链接</strong><small>查看该分类全部内容</small></div></button>}
      </div>
    </section>
  );
}

function LinkItemCard({ item, connectivity }: { item: LinkItem; connectivity?: ConnectivityResult }) {
  const state = connectivity?.state ?? "unknown";
  const metric = connectivity?.latencyMs != null ? `${connectivity.source === "browser" ? "HTTP " : ""}${connectivity.latencyMs} ms` : state === "checking" ? "…" : "—";
  const method = connectivity?.source === "probe" ? "本机 TCP" : "浏览器 HTTP";
  const status = state === "reachable" ? `可达，耗时 ${metric}` : state === "checking" ? "检测中" : state === "unknown" ? "无法确认" : "连接失败";
  const label = `${method}：${status}${connectivity?.reason ? `（${connectivity.reason}）` : ""}${connectivity?.checkedAt ? `，检查于 ${new Date(connectivity.checkedAt).toLocaleTimeString("zh-CN")}` : ""}`;
  return (
    <a className="link-card" href={item.url} target="_blank" rel="noreferrer">
      <span className="link-icon"><ItemIcon icon={item.icon} iconKind={item.iconKind} iconUrl={item.iconUrl} size={21} /></span>
      <span className="link-copy"><strong>{item.name}</strong><small>{item.description}</small></span>
      {item.connectivityEnabled !== false && <span className={`link-metric ${state}`} title={label} aria-label={label}><span className="connectivity-dot" />{metric}</span>}
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
        {services.filter((service) => service.enabled !== false).slice(0, compact ? 4 : 5).map((service) => {
          const localResult = localConnectivity[service.id];
          const hasMeta = (service.latencyMs != null && service.checkType !== "none" && !compact) || (service.checkType && service.checkType !== "none" && !compact) || localResult;
          return (
            <div className="status-row" key={service.id}>
              <div className="status-row-main">
                <span className={`status-dot ${service.checkType === "none" ? "unknown" : service.status}`} />
                <span className="status-name" title={service.name}>{service.name}</span>
                <span className={`status-label ${service.checkType === "none" ? "unknown" : service.status}`}>{statusLabel(service)}</span>
              </div>
              {hasMeta && (
                <div className="status-row-sub">
                  {service.latencyMs != null && service.checkType !== "none" && !compact && (
                    <span className="status-meta-item">服务器 {service.latencyMs}ms</span>
                  )}
                  {localResult && (
                    <>
                      {service.latencyMs != null && !compact && <span className="status-meta-divider" />}
                      <span className={`status-meta-item connectivity-label ${localResult.state}`} title="访问设备上的本机探针结果">
                        {localResult.latencyMs != null ? `本机 ${localResult.latencyMs}ms` : localResult.state === "checking" ? "本机检测中" : localResult.state === "unreachable" ? "本机失败" : "本机未确认"}
                      </span>
                    </>
                  )}
                  {service.checkType && service.checkType !== "none" && !compact && (
                    <>
                      <span className="status-meta-divider" />
                      <span className="status-meta-item status-source"><Wifi size={11} /> {service.checkType.toUpperCase()}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NetworkPanel() {
  const [httpInfo, setHttpInfo] = useState<{ address?: string; family?: string; status: string }>({ status: "unavailable" });
  const [webrtcAddress, setWebrtcAddress] = useState("");
  const [geoInfo, setGeoInfo] = useState<VisitorGeo>({});
  const [userAgent] = useState(() => navigator.userAgent);

  useEffect(() => {
    const controller = new AbortController();
    fetchClientNetwork(controller.signal).then((value) => { if (!controller.signal.aborted) setHttpInfo(value); }).catch(() => { if (!controller.signal.aborted) setHttpInfo({ status: "unavailable" }); });
    fetchVisitorGeo(controller.signal).then((value) => { if (!controller.signal.aborted) setGeoInfo(value); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (typeof RTCPeerConnection === "undefined") return;
    let active = true;
    let peer: RTCPeerConnection | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const close = () => { active = false; clearTimeout(timer); peer?.close(); };
    try {
      const connection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peer = connection;
      connection.createDataChannel("kitony-network");
      connection.onicecandidate = (event) => {
        const address = event.candidate && publicStunAddress(event.candidate);
        if (active && address) setWebrtcAddress((current) => current || address);
      };
      connection.onicegatheringstatechange = () => { if (connection.iceGatheringState === "complete") close(); };
      connection.createOffer().then((offer) => { if (active) return connection.setLocalDescription(offer); }).catch(close);
      timer = setTimeout(close, 5000);
    } catch {
      close();
    }
    return close;
  }, []);

  const httpAddress = httpInfo.address && isPublicAddress(httpInfo.address) ? httpInfo.address : "";
  const ipAddress = geoInfo.ip || httpAddress || webrtcAddress || "无法确认";
  const location = geoInfo.location || "无法确认";
  const operator = [geoInfo.isp, geoInfo.asn].filter(Boolean).join(" · ") || "无法确认";
  const ipFamily = ipAddress.includes(":") ? "IPv6" : /^\d+(?:\.\d+){3}$/.test(ipAddress) ? "IPv4" : "未知";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="network-float" aria-label="网络出口信息">
          <span className="network-float-summary">
            <span className="network-float-mark"><Globe2 size={14} /></span>
            <span className="network-pill" title={location}>{location}</span>
            <span className="network-pill network-pill-ip" title={ipAddress}>{ipAddress}</span>
            <span className="network-float-source">{ipFamily}</span>
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="network-popover" side="top" sideOffset={10} collisionPadding={12} aria-label="网络出口信息详情">
          <dl className="network-float-details">
            <div><dt>IP 地址</dt><dd>{ipAddress}</dd></div>
            <div><dt>位置</dt><dd>{location}</dd></div>
            <div><dt>运营商</dt><dd>{operator}</dd></div>
            <div><dt>UA</dt><dd title={userAgent}>{userAgent}</dd></div>
          </dl>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function UpdatesPanel({ updates, compact = false }: { updates: UpdateItem[]; compact?: boolean }) {
  return (
    <section className={`rail-panel updates-panel ${compact ? "compact-panel" : ""}`}>
      <div className="panel-heading"><div><span className="panel-kicker"><Rss size={14} /> 最近动态</span>{!compact && <h3>订阅源正在更新</h3>}</div><NavLink to="/updates" className="panel-action" title="查看全部动态" aria-label="查看全部动态"><ChevronRight size={17} /></NavLink></div>
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
    <motion.main className="page-content updates-page route-page-container" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
      <div className="page-heading"><div><span className="eyebrow">订阅与缓存</span><h1>动态</h1><p>把 RSS、YouTube 和 GitHub 的更新放在一个安静的列表里。</p></div><button className="primary-button" onClick={() => queryClient.invalidateQueries({ queryKey: ["bootstrap"] })}><RefreshCw size={16} /> 刷新全部</button></div>
      <Tabs.Root value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
      <Tabs.List className="filter-tabs" aria-label="动态来源">
        {(["全部", "RSS", "YouTube", "GitHub"] as const).map((item) => (
          <Tabs.Trigger value={item}
            className={filter === item ? "active" : ""}
            key={item}
          >
            {filter === item && <motion.span layoutId="active-filter-tab" className="tab-pill-active" transition={{ type: "spring", bounce: 0.15, duration: 0.35 }} />}
            <span>{item}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value={filter}>
        <div className="updates-table">{updates.map((item) => <a className="updates-table-row" href={item.url} target="_blank" rel="noreferrer" key={item.id}><span className={`source-chip ${item.source.toLowerCase()}`}><ItemIcon icon={item.source === "RSS" ? "rss" : item.source.toLowerCase()} size={15} />{item.source}</span><span className="updates-table-title">{item.title}</span><time>{item.time}</time><ArrowUpRight size={16} /></a>)}</div>
        {updates.length === 0 && <p className="empty-updates" role="status">暂无{filter === "全部" ? "" : ` ${filter} `}动态，可在设置中添加或刷新订阅。</p>}
      </Tabs.Content>
      </Tabs.Root>
    </motion.main>
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
  const [linkCategory, setLinkCategory] = useState(data.categories[0]?.id ?? 0);
  const validLinkCategory = data.categories.some((category) => category.id === linkCategory) ? linkCategory : (data.categories[0]?.id ?? 0);
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
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const success = (message: string) => setFeedback({ kind: "success", message });
  const failure = (error: Error, fallback: string) => setFeedback({ kind: "error", message: error.message || fallback });

  const resetCategory = () => { setEditingCategory(null); setCategoryName(""); setCategoryDescription(""); setCategoryIcon("folder"); setCategoryIconKind("builtin"); setCategoryIconUrl(""); };
  const resetLink = () => { setEditingLink(null); setLinkName(""); setLinkDescription(""); setLinkUrl(""); setLinkIcon("globe"); setLinkIconKind("builtin"); setLinkIconUrl(""); setLinkConnectivity(true); setLinkCategory(data.categories[0]?.id ?? 0); };
  const resetService = () => { setEditingService(null); setServiceName(""); setServiceEnabled(true); setServiceCheckType("none"); setServiceTarget(""); setServicePort("443"); };
  const resetSubscription = () => { setEditingSubscription(null); setSubscriptionType("rss"); setSubscriptionName(""); setSubscriptionUrl(""); setSubscriptionEnabled(true); setSubscriptionInterval("900"); };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
  const loginMutation = useMutation({ mutationFn: () => login(password), onSuccess: () => { setPassword(""); setLoginError(""); queryClient.invalidateQueries({ queryKey: ["session"] }); }, onError: (error: Error) => setLoginError(error.message || "登录失败") });
  const logoutMutation = useMutation({ mutationFn: logout, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session"] }) });
  const categoryMutation = useSaveMutation(createCategory, updateCategory, () => { success("分类已保存"); resetCategory(); void refresh(); }, (error) => failure(error, "分类保存失败"));
  const saveCategory = () => categoryMutation.save(editingCategory?.id, { name: categoryName, description: categoryDescription, icon: categoryIcon, iconKind: categoryIconKind, iconUrl: categoryIconUrl });
  const categoryDelete = useMutation({ mutationFn: deleteCategory, onSuccess: () => { success("分类已删除"); refresh(); }, onError: (error: Error) => failure(error, "删除失败") });
  const linkMutation = useSaveMutation(createLink, updateLink, () => { success("链接已保存"); resetLink(); void refresh(); }, (error) => failure(error, "链接保存失败"));
  const saveLink = () => {
    if (!validLinkCategory) return;
    linkMutation.save(editingLink?.id, { name: linkName, description: linkDescription, url: linkUrl, icon: linkIcon, iconKind: linkIconKind, iconUrl: linkIconUrl, categoryId: validLinkCategory, featured: editingLink?.featured ?? false, visible: editingLink?.visible ?? true, connectivityEnabled: linkConnectivity });
  };
  const linkDelete = useMutation({ mutationFn: deleteLink, onSuccess: () => { success("链接已删除"); refresh(); }, onError: (error: Error) => failure(error, "删除失败") });
  const serviceMutation = useSaveMutation(createService, updateService, () => { success("服务已保存"); resetService(); void refresh(); }, (error) => failure(error, "服务保存失败"));
  const saveService = () => serviceMutation.save(editingService?.id, { name: serviceName, enabled: serviceEnabled, checkType: serviceCheckType || "none", target: serviceTarget, port: Number(servicePort) || 0 });
  const serviceDelete = useMutation({ mutationFn: deleteService, onSuccess: () => { success("服务已删除"); refresh(); }, onError: (error: Error) => failure(error, "删除失败") });
  const serviceRefresh = useMutation({ mutationFn: refreshService, onSuccess: () => { success("服务状态已刷新"); refresh(); }, onError: (error: Error) => failure(error, "服务刷新失败") });
  const subscriptionMutation = useSaveMutation(createSubscription, updateSubscription, () => { success("订阅已保存"); resetSubscription(); void refresh(); }, (error) => failure(error, "订阅保存失败"));
  const saveSubscription = () => subscriptionMutation.save(editingSubscription?.id, { type: subscriptionType, name: subscriptionName, url: subscriptionUrl, enabled: subscriptionEnabled, intervalSeconds: Number(subscriptionInterval) || 900 });
  const subscriptionDelete = useMutation({ mutationFn: deleteSubscription, onSuccess: () => { success("订阅已删除"); refresh(); }, onError: (error: Error) => failure(error, "删除失败") });
  const subscriptionRefresh = useMutation({ mutationFn: refreshSubscription, onSuccess: () => { success("订阅已刷新"); refresh(); }, onError: (error: Error) => failure(error, "订阅刷新失败") });
  const saving = categoryMutation.isPending || linkMutation.isPending || serviceMutation.isPending || subscriptionMutation.isPending;
  const busy = saving || categoryDelete.isPending || linkDelete.isPending || serviceDelete.isPending || subscriptionDelete.isPending;

  const startCategoryEdit = (category: Category) => { setEditingCategory(category); setCategoryName(category.name); setCategoryDescription(category.description); setCategoryIcon(category.icon); setCategoryIconKind(category.iconKind ?? "builtin"); setCategoryIconUrl(category.iconUrl ?? ""); setTab("categories"); };
  const startLinkEdit = (item: LinkItem) => { setEditingLink(item); setLinkName(item.name); setLinkDescription(item.description); setLinkUrl(item.url); setLinkIcon(item.icon); setLinkIconKind(item.iconKind ?? "builtin"); setLinkIconUrl(item.iconUrl ?? ""); setLinkConnectivity(item.connectivityEnabled !== false); setLinkCategory(item.categoryId); setTab("links"); };
  const startServiceEdit = (item: ServiceStatus) => { setEditingService(item); setServiceName(item.name); setServiceEnabled(item.enabled !== false); setServiceCheckType(item.checkType ?? "none"); setServiceTarget(item.target ?? ""); setServicePort(String(item.port ?? 443)); setTab("services"); };
  const startSubscriptionEdit = (item: Subscription) => { setEditingSubscription(item); setSubscriptionType(item.type); setSubscriptionName(item.name); setSubscriptionUrl(item.url); setSubscriptionEnabled(item.enabled); setSubscriptionInterval(String(item.intervalSeconds || 900)); setTab("subscriptions"); };

  return <motion.main className="page-content admin-page route-page-container" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
    <div className="page-heading"><div><span className="eyebrow">管理控制台</span><h1>设置</h1><p>内容保存后立即生效；服务和订阅按配置刷新。</p></div><div className={`admin-status ${session.data?.authenticated ? "" : "is-locked"}`}>{session.data?.authenticated ? <><ShieldCheck size={16} /> 已登录</> : <><LogIn size={16} /> 需要登录</>}</div></div>
    {!session.data?.authenticated && <form className="admin-login" onSubmit={(event) => { event.preventDefault(); loginMutation.mutate(); }}><div><span className="eyebrow">管理员访问</span><h2>登录后编辑导航</h2><p>公开页面无需登录，只有保存配置时需要管理员会话。</p></div><div className="admin-login-fields"><label><span className="visually-hidden">管理员密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入管理员密码" autoComplete="current-password" /></label><button className="primary-button" type="submit" disabled={!password || loginMutation.isPending}><LogIn size={16} /> {loginMutation.isPending ? "登录中" : "登录"}</button></div>{loginError && <span className="login-error">{loginError}</span>}</form>}
    {session.error && <p className="settings-error" role="alert">无法确认登录状态：{session.error.message}</p>}
    {session.data?.authenticated && <div className="admin-account-bar"><span><Check size={15} /> 当前会话有效，修改会直接写入 SQLite</span><button className="quiet-button" disabled={busy || logoutMutation.isPending} onClick={() => logoutMutation.mutate()}><LogOut size={15} /> 退出</button></div>}
    {session.data?.authenticated && (
      <fieldset className="admin-fields" disabled={busy} aria-busy={busy}>
      <Tabs.Root value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
      <Tabs.List className="admin-tabs" aria-label="管理分区">
        {[
          { id: "categories", label: "分类", icon: <LayoutGrid size={16} /> },
          { id: "links", label: "链接", icon: <Link2 size={16} /> },
          { id: "services", label: "服务状态", icon: <Activity size={16} /> },
          { id: "subscriptions", label: "动态订阅", icon: <Rss size={16} /> },
          { id: "settings", label: "外观", icon: <SlidersHorizontal size={16} /> },
        ].map((item) => (
          <Tabs.Trigger value={item.id}
            className={tab === item.id ? "active" : ""}
            key={item.id}
          >
            {tab === item.id && <motion.span layoutId="active-admin-tab" className="tab-pill-active" transition={{ type: "spring", bounce: 0.15, duration: 0.35 }} />}
            {item.icon}
            <span>{item.label}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    {feedback && <div className={`feedback-banner ${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.kind === "error" ? <CircleAlert size={16} /> : <Check size={16} />}<span>{feedback.message}</span><button onClick={() => setFeedback(null)} aria-label="关闭提示"><X size={15} /></button></div>}
      <Tabs.Content value={tab}>
      {tab === "categories" && <div className="admin-grid">
        <section className="admin-section">
          <div className="section-title"><div><span className="eyebrow">目录结构</span><h2>收藏夹</h2></div><button className="primary-button" onClick={resetCategory}><Plus size={16} /> 新增收藏夹</button></div>
          <div className="admin-list">{data.categories.map((category) => <div className="admin-list-row" key={category.id}>
            <span className="admin-item-icon"><ItemIcon icon={category.icon} iconKind={category.iconKind} iconUrl={category.iconUrl} size={18} /></span>
            <span className="admin-item-copy"><strong>{category.name}</strong><small>{category.description} · {category.links.length} 个链接</small></span>
            <button className="icon-button subtle" onClick={() => startCategoryEdit(category)} title="编辑收藏夹"><Edit3 size={16} /></button>
            <button className="icon-button subtle danger" onClick={() => categoryDelete.mutate(category.id)} title="删除收藏夹"><Trash2 size={16} /></button>
          </div>)}</div>
        </section>
        <CategoryForm editing={editingCategory} name={categoryName} description={categoryDescription} icon={categoryIcon} iconKind={categoryIconKind} iconUrl={categoryIconUrl} setName={setCategoryName} setDescription={setCategoryDescription} setIcon={setCategoryIcon} setIconKind={setCategoryIconKind} setIconUrl={setCategoryIconUrl} onSubmit={saveCategory} onCancel={resetCategory} />
      </div>}
      {tab === "links" && <div className="admin-grid">
        <section className="admin-section">
          <div className="section-title"><div><span className="eyebrow">链接目录</span><h2>全部链接</h2></div><button className="primary-button" onClick={resetLink}><Plus size={16} /> 新增链接</button></div>
          <div className="admin-list">{data.categories.flatMap((category) => category.links.map((item) => ({ item, category }))).map(({ item, category }) => <div className="admin-list-row" key={item.id}>
            <span className="admin-item-icon"><ItemIcon icon={item.icon} iconKind={item.iconKind} iconUrl={item.iconUrl} size={18} /></span>
            <span className="admin-item-copy"><strong>{item.name}</strong><small>{category.name} · {item.url}</small></span>
            <button className="icon-button subtle" onClick={() => startLinkEdit(item)} title="编辑链接"><Edit3 size={16} /></button>
            <button className="icon-button subtle danger" onClick={() => linkDelete.mutate(item.id)} title="删除链接"><Trash2 size={16} /></button>
          </div>)}</div>
        </section>
        <LinkForm editing={editingLink} name={linkName} description={linkDescription} url={linkUrl} icon={linkIcon} iconKind={linkIconKind} iconUrl={linkIconUrl} connectivityEnabled={linkConnectivity} categoryId={validLinkCategory} categories={data.categories} setName={setLinkName} setDescription={setLinkDescription} setUrl={setLinkUrl} setIcon={setLinkIcon} setIconKind={setLinkIconKind} setIconUrl={setLinkIconUrl} setConnectivityEnabled={setLinkConnectivity} setCategoryId={setLinkCategory} onSubmit={saveLink} onCancel={resetLink} />
      </div>}
      {tab === "services" && <div className="admin-grid">
        <section className="admin-section">
          <div className="section-title"><div><span className="eyebrow">关注清单</span><h2>服务状态</h2></div><button className="primary-button" onClick={resetService}><Plus size={16} /> 新增服务</button></div>
          <div className="admin-list">{data.services.map((item) => <div className="admin-list-row" key={item.id}>
            <span className={`status-dot ${item.status}`} /><span className="admin-item-copy"><strong>{item.name}</strong><small>{item.checkType === "none" ? "未配置检查" : `${(item.checkType ?? "none").toUpperCase()} · ${item.target || ""}${item.port ? `:${item.port}` : ""}`} · {item.status === "online" ? "正常" : item.status === "degraded" ? "异常" : item.status === "offline" ? "离线" : "待检查"}</small></span>
            <button className="icon-button subtle" onClick={() => serviceRefresh.mutate(item.id)} title="刷新服务状态"><RefreshCw size={16} /></button>
            <button className="icon-button subtle" onClick={() => startServiceEdit(item)} title="编辑服务"><Edit3 size={16} /></button>
            <button className="icon-button subtle danger" onClick={() => serviceDelete.mutate(item.id)} title="删除服务"><Trash2 size={16} /></button>
          </div>)}</div>
        </section>
        <ServiceForm editing={editingService} name={serviceName} enabled={serviceEnabled} checkType={serviceCheckType ?? "none"} target={serviceTarget} port={servicePort} setName={setServiceName} setEnabled={setServiceEnabled} setCheckType={setServiceCheckType} setTarget={setServiceTarget} setPort={setServicePort} onSubmit={saveService} onCancel={resetService} />
      </div>}
      {tab === "subscriptions" && <div className="admin-grid">
        <section className="admin-section">
          <div className="section-title"><div><span className="eyebrow">关注内容</span><h2>动态订阅</h2></div><button className="primary-button" onClick={resetSubscription}><Plus size={16} /> 新增订阅</button></div>
          <div className="admin-list">{(data.subscriptions ?? []).map((item) => <div className="admin-list-row" key={item.id}>
            <span className={`source-dot ${item.type}`} /><span className="admin-item-copy"><strong>{item.name}</strong><small>{item.type.toUpperCase()} · {item.itemCount ?? 0} 条缓存{item.lastError ? ` · ${item.lastError}` : ""}</small></span>
            <button className="icon-button subtle" onClick={() => subscriptionRefresh.mutate(item.id)} title="刷新订阅"><RefreshCw size={16} /></button>
            <button className="icon-button subtle" onClick={() => startSubscriptionEdit(item)} title="编辑订阅"><Edit3 size={16} /></button>
            <button className="icon-button subtle danger" onClick={() => subscriptionDelete.mutate(item.id)} title="删除订阅"><Trash2 size={16} /></button>
          </div>)}</div>
        </section>
        <SubscriptionForm editing={editingSubscription} type={subscriptionType} name={subscriptionName} url={subscriptionUrl} enabled={subscriptionEnabled} interval={subscriptionInterval} setType={setSubscriptionType} setName={setSubscriptionName} setUrl={setSubscriptionUrl} setEnabled={setSubscriptionEnabled} setInterval={setSubscriptionInterval} onSubmit={saveSubscription} onCancel={resetSubscription} />
      </div>}
    {session.data?.authenticated && tab === "settings" && <SettingsPanel data={data} />}
      </Tabs.Content>
      </Tabs.Root>
      </fieldset>
    )}
  </motion.main>;
}

function IconFields({ icon, iconKind, iconUrl, setIcon, setIconKind, setIconUrl }: { icon: string; iconKind: "builtin" | "url"; iconUrl: string; setIcon: (value: string) => void; setIconKind: (value: "builtin" | "url") => void; setIconUrl: (value: string) => void }) {
  return <div className="icon-fields"><label>图标来源<select value={iconKind} onChange={(event) => setIconKind(event.target.value as "builtin" | "url")}><option value="builtin">内置图标</option><option value="url">图片地址</option></select></label>{iconKind === "builtin" ? <label>内置图标<select value={icon} onChange={(event) => setIcon(event.target.value)}>{iconOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> : <label>图片地址<input value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} placeholder="https://..." inputMode="url" /></label>}<span className="icon-preview"><ItemIcon icon={icon} iconKind={iconKind} iconUrl={iconUrl} size={20} /></span></div>;
}

function CategoryForm({ editing, name, description, icon, iconKind, iconUrl, setName, setDescription, setIcon, setIconKind, setIconUrl, onSubmit, onCancel }: { editing: Category | null; name: string; description: string; icon: string; iconKind: "builtin" | "url"; iconUrl: string; setName: (value: string) => void; setDescription: (value: string) => void; setIcon: (value: string) => void; setIconKind: (value: "builtin" | "url") => void; setIconUrl: (value: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return <section className="editor-panel"><div className="section-title"><div><span className="eyebrow">{editing ? "编辑收藏夹" : "新建收藏夹"}</span><h2>{editing ? editing.name : "添加一个收藏夹"}</h2></div></div><label>名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：设计资源" /></label><label>描述<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="一句话说明这个收藏夹" /></label><IconFields icon={icon} iconKind={iconKind} iconUrl={iconUrl} setIcon={setIcon} setIconKind={setIconKind} setIconUrl={setIconUrl} /><div className="form-actions"><button className="quiet-button" onClick={onCancel}>取消</button><button className="primary-button" onClick={onSubmit} disabled={!name.trim()}><Check size={16} /> 保存收藏夹</button></div></section>;
}

function LinkForm({ editing, name, description, url, icon, iconKind, iconUrl, connectivityEnabled, categoryId, categories, setName, setDescription, setUrl, setIcon, setIconKind, setIconUrl, setConnectivityEnabled, setCategoryId, onSubmit, onCancel }: { editing: LinkItem | null; name: string; description: string; url: string; icon: string; iconKind: "builtin" | "url"; iconUrl: string; connectivityEnabled: boolean; categoryId: number; categories: Category[]; setName: (value: string) => void; setDescription: (value: string) => void; setUrl: (value: string) => void; setIcon: (value: string) => void; setIconKind: (value: "builtin" | "url") => void; setIconUrl: (value: string) => void; setConnectivityEnabled: (value: boolean) => void; setCategoryId: (value: number) => void; onSubmit: () => void; onCancel: () => void }) {
  return <section className="editor-panel">
    <div className="section-title"><div><span className="eyebrow">{editing ? "编辑链接" : "新建链接"}</span><h2>{editing ? editing.name : "添加一个链接"}</h2></div></div>
    <label>名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：Notion" /></label>
    <label>描述<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="简短的用途描述" /></label>
    <label>地址<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" inputMode="url" /></label>
    <label>所属分类<select value={categoryId} disabled={categories.length === 0} onChange={(event) => setCategoryId(Number(event.target.value))}>
      {categories.length === 0 && <option value={0}>请先创建收藏夹</option>}
      {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
    </select></label>
    {categories.length === 0 && <p className="form-empty" role="status">尚无收藏夹，请先在分类分区创建。</p>}
    <IconFields icon={icon} iconKind={iconKind} iconUrl={iconUrl} setIcon={setIcon} setIconKind={setIconKind} setIconUrl={setIconUrl} />
    <label className="checkbox-row"><input type="checkbox" checked={connectivityEnabled} onChange={(event) => setConnectivityEnabled(event.target.checked)} /> 在主页显示本机连通性</label>
    <div className="form-actions"><button className="quiet-button" onClick={onCancel}>取消</button><button className="primary-button" onClick={onSubmit} disabled={!name.trim() || !url.trim() || !categories.some((category) => category.id === categoryId)}><Check size={16} /> 保存链接</button></div>
  </section>;
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
    mutationFn: () => updateSettings({ brandName, brandDescription, defaultEngine, weatherLocation, timezone, theme: themeDefault, clockStyle, clock24Hour, clockSeconds, clockColor, clockSpeed: Math.min(3, Math.max(1, Math.round(Number(clockSpeed) || 1))) }),
    onSuccess: () => { setSaveError(""); queryClient.invalidateQueries({ queryKey: ["bootstrap"] }); },
    onError: (error: Error) => setSaveError(error.message || "保存设置失败"),
  });
  return <section className="settings-form"><div className="section-title"><div><span className="eyebrow">站点偏好</span><h2>外观与默认值</h2></div><button className="primary-button" onClick={() => mutation.mutate()} disabled={mutation.isPending}><Check size={16} /> {mutation.isPending ? "保存中" : "保存设置"}</button></div><div className="settings-grid"><label>站点名称<input value={brandName} onChange={(event) => setBrandName(event.target.value)} /></label><label>默认搜索引擎<select value={defaultEngine} onChange={(event) => setDefaultEngine(event.target.value)}>{engineOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>天气城市<input value={weatherLocation} onChange={(event) => setWeatherLocation(event.target.value)} /></label><label>默认时区<input value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label><label className="settings-wide">站点说明<input value={brandDescription} onChange={(event) => setBrandDescription(event.target.value)} placeholder="可留空" /></label><label>主题默认值<select value={themeDefault} onChange={(event) => setThemeDefault(event.target.value as Theme)}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label><label>时钟样式<select value={clockStyle} onChange={(event) => setClockStyle(event.target.value as AppearanceSettings["clockStyle"])}>{clockStyles.map((style) => <option key={style} value={style}>{style === "plain" ? "标准" : style === "flip" ? "翻页" : style === "ticker" ? "滚动" : "柔和发光"}</option>)}</select></label><label className="checkbox-row"><input type="checkbox" checked={clock24Hour} onChange={(event) => setClock24Hour(event.target.checked)} /> 24 小时制</label><label className="checkbox-row"><input type="checkbox" checked={clockSeconds} onChange={(event) => setClockSeconds(event.target.checked)} /> 显示秒数</label><label>时钟颜色<input type="color" value={clockColor} onChange={(event) => setClockColor(event.target.value)} /></label><label>动画速度<input type="number" min="1" max="3" value={clockSpeed} onChange={(event) => setClockSpeed(event.target.value)} /></label></div>{saveError && <p className="settings-error">{saveError}</p>}<div className="settings-note"><CircleHelp size={17} /><span>主页主题菜单可选择跟随系统、浅色或深色；时钟效果只影响顶部显示；时区请填写 IANA 名称，例如 Asia/Shanghai。</span></div></section>;
}

export { App };
