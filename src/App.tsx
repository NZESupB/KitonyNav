import { lazy, memo, Suspense, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import { Dialog, DropdownMenu } from "radix-ui";
import { NavLink, Route, Routes } from "react-router-dom";
import {
  Activity, ArrowUpRight, Check, ChevronDown, ChevronRight, CircleAlert,
  House, Menu, MessageCircle, Moon, PanelLeftClose, PanelLeftOpen,
  RefreshCw, Rss, Search, Settings2, Sun, X,
} from "lucide-react";
import { formatConnectivity } from "./lib/connectivity";
import { useMediaQuery } from "./hooks/use-media-query";
import { UI_STORAGE_KEY, useUIStore, type Theme } from "./stores/ui-store";
import { ClockProvider } from "./hooks/use-clock";
import { ClockDateWidget } from "./components/clock/ClockDateWidget";
import { SearchBar } from "./components/search/SearchBar";
import { CategoryOutline } from "./components/navigation/CategoryOutline";
import { CategorySection } from "./components/navigation/CategorySection";
import { NetworkPanel } from "./components/network/NetworkPanel";
import { CHECKING_RESULT, connectivityKey, useConnectivity } from "./stores/connectivity-store";
import { WeatherWidget } from "./components/weather/WeatherWidget";
import { useCategoryOutline } from "./hooks/use-category-outline";
import { directoryCategories } from "./lib/directory";
import { buildSearchUrl, resolveEngine } from "./lib/search";
import { defaultAppearance } from "./lib/appearance";
import { fetchBootstrap } from "./api";
import { normalizeBootstrap, type BootstrapData, type ServiceStatus, type UpdateItem } from "./data";
import { useDeviceConnectivity } from "./hooks/use-connectivity";

// 设置页与动态页不在首屏，按路由懒加载以减小首屏 JS
const AdminPage = lazy(() => import("./pages/AdminPage"));
const UpdatesPage = lazy(() => import("./pages/UpdatesPage"));
const routeFallback = <div className="app-loading" role="status"><div className="loading-orb" /><span>正在加载页面</span></div>;

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

function themeLabel(theme: Theme) {
  return theme === "system" ? "跟随系统" : theme === "light" ? "浅色模式" : "深色模式";
}


function App() {
  return <ClockProvider><MotionConfig reducedMotion="user"><AppShell /></MotionConfig></ClockProvider>;
}

function AppShell() {
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["bootstrap"], queryFn: ({ signal }) => fetchBootstrap(signal),
    select: normalizeBootstrap,
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

  if (!data) {
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
                <Sidebar data={data} mobile />
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        ) : (
          <motion.aside className="sidebar" initial={false} animate={{ width: collapsed ? 80 : 252 }} transition={reducedMotion ? { duration: 0 } : sidebarTransition}>
            <Sidebar data={data} />
          </motion.aside>
        )}
        <div className="workspace">
          <TopBar data={data} resolvedTheme={resolvedTheme} />
          {error && <div className="feedback-banner error" role="alert"><CircleAlert size={16} /><span>同步失败，正在显示上次成功的数据：{error.message}</span><button disabled={isFetching} onClick={() => void refetch()} aria-label="重试同步"><RefreshCw size={16} /></button></div>}
          <Routes>
            <Route path="/" element={<HomePage data={data} />} />
            <Route path="/updates" element={<Suspense fallback={routeFallback}><UpdatesPage data={data} /></Suspense>} />
            <Route path="/admin" element={<Suspense fallback={routeFallback}><AdminPage data={data} /></Suspense>} />
            <Route path="*" element={<HomePage data={data} />} />
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
});

function Sidebar({ data, mobile = false }: { data: BootstrapData; mobile?: boolean }) {
  const collapsed = useUIStore((state) => state.collapsed);
  const setCollapsed = useUIStore((state) => state.setCollapsed);
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
          <CategoryOutline categories={data.categories} collapsed={collapsed} />
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
  const appearance = data.settings.appearance ?? defaultAppearance;
  const theme = useUIStore((state) => state.theme) ?? appearance.theme;
  const setTheme = useUIStore((state) => state.setTheme);
  return (
    <header className="topbar">
      <Dialog.Trigger asChild><button className="mobile-menu-button icon-button" aria-label="打开导航"><Menu size={20} /></button></Dialog.Trigger>
      <div className="topbar-meta">
        <WeatherWidget fallbackCity={data.settings.weatherLocation} />
        <span className="topbar-divider" />
        <ClockDateWidget appearance={appearance} timezone={data.settings.timezone} />
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

function HomePage({ data }: { data: BootstrapData }) {
  const query = useUIStore((state) => state.searchQuery);
  const setQuery = useUIStore((state) => state.setSearchQuery);
  const deferredQuery = useDeferredValue(query);
  const [engine, setEngine] = useState(() => resolveEngine(data.settings.defaultEngine));
  const visibleLinks = useMemo(() => directoryCategories(data.categories).flatMap((category) => category.links), [data.categories]);
  useDeviceConnectivity(visibleLinks, data.services);
  const visibleCategories = useMemo(() => directoryCategories(data.categories, deferredQuery), [data.categories, deferredQuery]);
  useCategoryOutline(visibleCategories);
  const compactLayout = useMediaQuery("(max-width: 980px)");
  const openSearch = () => {
    if (query.trim()) window.open(buildSearchUrl(engine, query), "_blank", "noopener,noreferrer");
  };
  return (
    <motion.main className="home-layout route-page-container" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
      <div className="home-main">
        <SearchBar query={query} onChange={setQuery} engine={engine} onEngineChange={setEngine} onSearch={openSearch} />
        {deferredQuery.trim() ? (
          <div className="home-content-header">
            <div><span className="eyebrow">搜索结果 · {visibleCategories.reduce((count, item) => count + item.links.length, 0)} 个链接</span><h1>找到你要去的地方</h1></div>
          </div>
        ) : null}
        <div className="directory-list">
          {deferredQuery.trim() && visibleCategories.length === 0 ? (
            <div className="empty-search-state">
              <div className="empty-search-icon"><Search size={22} /></div>
              <h3>未找到与“{deferredQuery}”相关的链接</h3>
              <p>可以更换关键词，或使用外部引擎搜索</p>
              <div className="empty-search-actions"><button className="quiet-button" onClick={() => setQuery("")}>清空输入</button><button className="primary-button" onClick={openSearch}>使用 {engine} 搜索</button></div>
            </div>
          ) : visibleCategories.length === 0 ? (
            <div className="empty-search-state" role="status"><h3>暂无可显示的分类</h3><p>在设置中添加分类与链接。</p></div>
          ) : visibleCategories.map((category) => <CategorySection category={category} key={category.id} />)}
        </div>
        {compactLayout && (
          <div className="bottom-panels">
            <StatusPanel services={data.services} compact />
            <UpdatesPanel updates={data.updates} compact />
          </div>
        )}
        <NetworkPanel />
        <div data-outline-end className="directory-end" aria-hidden="true" />
      </div>
      {!compactLayout && <aside className="home-rail"><StatusPanel services={data.services} /><UpdatesPanel updates={data.updates} /></aside>}
    </motion.main>
  );
}

const ServiceStatusRow = memo(function ServiceStatusRow({
  service,
}: {
  service: ServiceStatus;
}) {
  const result = useConnectivity(connectivityKey.service(service.id)) ?? CHECKING_RESULT;
  // 未配置 http(s) 检测地址的服务不会进入测速队列，直接给出原因而不是停在“检测中”。
  const unconfigured = !/^https?:\/\//i.test(service.target?.trim() ?? "");
  const display = useMemo(() => formatConnectivity(result), [result]);

  let dotClass = "unknown";
  let labelText = "无法确认";

  if (unconfigured) {
    dotClass = "unknown";
    labelText = "未配置检测地址";
  } else if (display.state === "reachable") {
    dotClass = "online";
    labelText = "正常";
  } else if (display.state === "unreachable") {
    dotClass = "offline";
    labelText = "离线";
  } else if (display.state === "checking") {
    dotClass = "checking";
    labelText = "检测中";
  } else if (display.state === "stale") {
    dotClass = "unknown";
    labelText = display.text;
  } else {
    dotClass = "unknown";
    labelText = result.reasonCode === "browser-restricted" ? "浏览器受限"
      : typeof result.reason === "string" && result.reason.trim() ? result.reason : "无法确认";
  }

  return (
    <div className={`status-row ${dotClass === "offline" ? "is-offline" : ""} status-${dotClass}`}>
      <div className="status-row-main">
        <span className={`status-dot ${dotClass}`} />
        <span className="status-name" title={service.name}>{service.name}</span>
        <span className={`status-label status-chip ${dotClass}`}>{labelText}</span>
      </div>
      <div className="status-row-sub">
        <span
          className={`status-meta-item connectivity-label ${display.level ?? display.state}`}
          title={display.title}
        >
          {display.text}
        </span>
      </div>
    </div>
  );
});

function StatusPanel({ services, compact = false }: { services: BootstrapData["services"]; compact?: boolean }) {
  return (
    <section className={`rail-panel status-panel ${compact ? "compact-panel" : ""}`}>
      <div className="panel-heading"><div><span className="panel-kicker"><Activity size={14} /> 服务状态</span>{!compact && <h3>你关注的服务</h3>}</div></div>
      <div className="status-list">
        {services.filter((service) => service.enabled !== false).slice(0, compact ? 4 : 5).map((service) => (
          <ServiceStatusRow key={service.id} service={service} />
        ))}
      </div>
    </section>
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

export { App };
