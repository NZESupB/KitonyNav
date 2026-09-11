import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  Folder,
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
  Zap,
  Clock3,
  Music2,
  Wallet,
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
  deleteCategory,
  deleteLink,
  fetchBootstrap,
  fetchSession,
  login,
  logout,
  updateCategory,
  updateLink,
  updateSettings,
} from "./api";
import { engineOptions, engineUrls, type BootstrapData, type Category, type LinkItem, type UpdateItem } from "./data";

type Theme = "light" | "dark";
type IconKey = string;

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

function ItemIcon({ icon, size = 20 }: { icon: IconKey; size?: number }) {
  const BrandIcon = brandIcons[icon];
  if (BrandIcon) return <BrandIcon size={size} aria-hidden="true" />;
  const UiIcon = uiIcons[icon] ?? Link2;
  return <UiIcon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function relativeTime(value: string) {
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

function App() {
  return <AppShell />;
}

function AppShell() {
  const { data, isFetching } = useQuery({ queryKey: ["bootstrap"], queryFn: fetchBootstrap, staleTime: 30_000 });
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("kitony-theme") as Theme) || "light");
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("kitony-sidebar") === "collapsed");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("kitony-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("kitony-sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  const appData = data ? {
    ...data,
    categories: data.categories.map((category) => ({ ...category, links: category.links ?? [] })),
  } : undefined;

  if (!appData) {
    return <div className="app-loading"><div className="loading-orb" /><span>准备你的导航空间</span></div>;
  }

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${mobileMenuOpen ? "mobile-menu-open" : ""}`}>
      <Sidebar
        data={appData}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        theme={theme}
        setTheme={setTheme}
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
  theme,
  setTheme,
  activeCategory,
  setActiveCategory,
  mobileMenuOpen,
  setMobileMenuOpen,
}: {
  data: BootstrapData;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  theme: Theme;
  setTheme: (value: Theme) => void;
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
            <div className="brand-mark"><Zap size={18} strokeWidth={2.6} /></div>
            {!collapsed && <div><div className="brand-name">Kitony<span>Nav</span></div><div className="brand-subtitle">个人导航 · React + Go</div></div>}
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
            {data.categories.slice(0, collapsed ? 4 : 5).map((category) => (
              <button
                className={`folder-row ${activeCategory === category.id ? "selected" : ""}`}
                key={category.id}
                onClick={() => setActiveCategory(activeCategory === category.id ? null : category.id)}
                title={collapsed ? category.name : undefined}
              >
                <Folder size={17} strokeWidth={1.7} />
                {!collapsed && <><span>{category.name}{category.name === "常用" ? "网站" : ""}</span><MoreHorizontal size={16} className="folder-more" /></>}
              </button>
            ))}
          </div>
          <div className="sidebar-spacer" />
          <div className="sidebar-footer">
            <button className="theme-control" onClick={() => setTheme(theme === "light" ? "dark" : "light")} title="切换主题">
              {theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
              {!collapsed && <><span>{theme === "light" ? "浅色主题" : "深色主题"}</span><ChevronDown size={16} /></>}
            </button>
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
  const time = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const date = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
  return (
    <header className="topbar">
      <button className="mobile-menu-button icon-button" onClick={onOpenMenu} aria-label="打开导航"><Menu size={20} /></button>
      <div className="topbar-meta">
        <span className="weather-inline"><CloudSun size={19} /><span>{data.settings.weatherLocation}</span><strong>24°C</strong><em>多云</em></span>
        <span className="topbar-divider" />
        <span className="time-inline"><Clock3 size={18} /><strong>{time}</strong><span>{date}</span></span>
        <span className="topbar-divider" />
        <button className="topbar-theme" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="切换主题">{theme === "light" ? <Sun size={18} /> : <Moon size={18} />}<span>{theme === "light" ? "浅色模式" : "深色模式"}</span><ChevronDown size={15} /></button>
      </div>
    </header>
  );
}

function HomePage({ data, activeCategory, setActiveCategory, isFetching }: { data: BootstrapData; activeCategory: number | null; setActiveCategory: (value: number | null) => void; isFetching: boolean }) {
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState(data.settings.defaultEngine || "Google");
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();

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
    const target = engineUrls[activeEngine].replace("QUERY", encodeURIComponent(searchQuery));
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
          {visibleCategories.slice(0, query || activeCategory !== null || showAll ? undefined : 3).map((category) => <CategorySection category={category} key={category.id} onMore={() => setActiveCategory(category.id)} />)}
        </div>

        {!query && activeCategory === null && visibleCategories.length > 3 && <button className="show-more-button" onClick={() => setShowAll(!showAll)}>{showAll ? "收起分类" : "查看全部分类"}<ChevronDown size={16} className={showAll ? "rotated" : ""} /></button>}

        <div className="bottom-panels">
          <StatusPanel services={data.services} compact />
          <UpdatesPanel updates={data.updates} compact />
        </div>
        <div className="sync-banner"><div className="sync-icon"><Activity size={17} /></div><div><strong>内容持续更新中</strong><span>我们会定期为你筛选和添加优质资源，关注动态不再错过最新内容。</span></div><span className="sync-time">{isFetching ? "同步中" : "刚刚同步"}</span></div>
      </div>
      <aside className="home-rail">
        <StatusPanel services={data.services} />
        <UpdatesPanel updates={data.updates} />
      </aside>
    </main>
  );
}

function CategorySection({ category, onMore }: { category: Category; onMore: () => void }) {
  return (
    <section className="category-section">
      <div className="category-heading"><div className="category-title"><span className="category-icon"><ItemIcon icon={category.icon} size={21} /></span><div><h2>{category.name}</h2><p>{category.description}</p></div></div><button className="category-more" onClick={onMore} aria-label={`查看${category.name}全部链接`}><ChevronRight size={19} /></button></div>
      <div className="link-grid">
        {category.links.slice(0, 8).map((item) => <LinkItemCard item={item} key={item.id} />)}
        {category.links.length > 8 && <button className="link-card more-card" onClick={onMore}><span><MoreHorizontal size={20} /></span><div><strong>更多链接</strong><small>查看该分类全部内容</small></div></button>}
      </div>
    </section>
  );
}

function LinkItemCard({ item }: { item: LinkItem }) {
  return (
    <a className="link-card" href={item.url} target="_blank" rel="noreferrer">
      <span className="link-icon"><ItemIcon icon={item.icon} size={21} /></span>
      <span className="link-copy"><strong>{item.name}</strong><small>{item.description}</small></span>
      <ArrowUpRight className="link-arrow" size={15} />
    </a>
  );
}

function StatusPanel({ services, compact = false }: { services: BootstrapData["services"]; compact?: boolean }) {
  return (
    <section className={`rail-panel status-panel ${compact ? "compact-panel" : ""}`}>
      <div className="panel-heading"><div><span className="panel-kicker"><Activity size={14} /> 服务状态</span>{!compact && <h3>你关注的服务</h3>}</div><button className="panel-action" title="刷新状态" aria-label="刷新状态"><RefreshCw size={15} /></button></div>
      <div className="status-list">
        {services.slice(0, compact ? 4 : 5).map((service) => <div className="status-row" key={service.id}><span className={`status-dot ${service.status}`} /><span className="status-name">{service.name}</span><span className={`status-label ${service.status}`}>{service.status === "online" ? "正常" : service.status === "degraded" ? "异常" : service.status === "offline" ? "离线" : "待检查"}</span>{service.latencyMs && !compact && <span className="status-latency">{service.latencyMs}ms</span>}</div>)}
      </div>
      <button className="panel-link">查看全部状态 <ArrowUpRight size={14} /></button>
    </section>
  );
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
  const [filter, setFilter] = useState<"全部" | UpdateItem["source"]>("全部");
  const updates = filter === "全部" ? data.updates : data.updates.filter((item) => item.source === filter);
  return (
    <main className="page-content updates-page">
      <div className="page-heading"><div><span className="eyebrow">订阅与缓存</span><h1>动态</h1><p>把 RSS、YouTube 和 GitHub 的更新放在一个安静的列表里。</p></div><button className="primary-button"><RefreshCw size={16} /> 刷新全部</button></div>
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
  const [tab, setTab] = useState<"categories" | "links" | "settings">("categories");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("folder");
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [linkName, setLinkName] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCategory, setLinkCategory] = useState(data.categories[0]?.id ?? 1);
  const [feedback, setFeedback] = useState("");

  const loginMutation = useMutation({
    mutationFn: () => login(password),
    onSuccess: () => { setPassword(""); setLoginError(""); queryClient.invalidateQueries({ queryKey: ["session"] }); },
    onError: (error: Error) => setLoginError(error.message || "登录失败"),
  });
  const logoutMutation = useMutation({ mutationFn: logout, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session"] }) });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
  const categoryMutation = useMutation({
    mutationFn: () => editingCategory ? updateCategory(editingCategory.id, { name: categoryName, description: categoryDescription, icon: categoryIcon }) : createCategory({ name: categoryName, description: categoryDescription, icon: categoryIcon }),
    onSuccess: () => { setFeedback("分类已保存"); setEditingCategory(null); setCategoryName(""); setCategoryDescription(""); refresh(); },
    onError: (error: Error) => setFeedback(error.message || "保存失败，请先登录后台"),
  });
  const categoryDelete = useMutation({ mutationFn: deleteCategory, onSuccess: () => { setFeedback("分类已删除"); refresh(); }, onError: (error: Error) => setFeedback(error.message || "删除失败") });
  const linkMutation = useMutation({
    mutationFn: () => editingLink ? updateLink(editingLink.id, { name: linkName, description: linkDescription, url: linkUrl, icon: editingLink.icon, categoryId: linkCategory, featured: editingLink.featured, visible: editingLink.visible }) : createLink({ name: linkName, description: linkDescription, url: linkUrl, icon: "globe", categoryId: linkCategory, featured: false, visible: true }),
    onSuccess: () => { setFeedback("链接已保存"); setEditingLink(null); setLinkName(""); setLinkDescription(""); setLinkUrl(""); refresh(); },
    onError: (error: Error) => setFeedback(error.message || "保存失败，请先登录后台"),
  });
  const linkDelete = useMutation({ mutationFn: deleteLink, onSuccess: () => { setFeedback("链接已删除"); refresh(); }, onError: (error: Error) => setFeedback(error.message || "删除失败") });

  const startCategoryEdit = (category: Category) => { setEditingCategory(category); setCategoryName(category.name); setCategoryDescription(category.description); setCategoryIcon(category.icon); setTab("categories"); };
  const startLinkEdit = (item: LinkItem) => { setEditingLink(item); setLinkName(item.name); setLinkDescription(item.description); setLinkUrl(item.url); setLinkCategory(item.categoryId); setTab("links"); };

  return (
    <main className="page-content admin-page">
      <div className="page-heading"><div><span className="eyebrow">管理控制台</span><h1>设置</h1><p>内容保存后立即生效，不需要重新构建或重启服务。</p></div><div className={`admin-status ${session.data?.authenticated ? "" : "is-locked"}`}>{session.data?.authenticated ? <><ShieldCheck size={16} /> 已登录</> : <><LogIn size={16} /> 需要登录</>}</div></div>
      {!session.data?.authenticated && <form className="admin-login" onSubmit={(event) => { event.preventDefault(); loginMutation.mutate(); }}><div><span className="eyebrow">管理员访问</span><h2>登录后编辑导航</h2><p>公开页面无需登录，只有保存分类和链接时需要管理员会话。</p></div><div className="admin-login-fields"><label><span className="visually-hidden">管理员密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入管理员密码" autoComplete="current-password" /></label><button className="primary-button" type="submit" disabled={!password || loginMutation.isPending}><LogIn size={16} /> {loginMutation.isPending ? "登录中" : "登录"}</button></div>{loginError && <span className="login-error">{loginError}</span>}</form>}
      {session.data?.authenticated && <div className="admin-account-bar"><span><Check size={15} /> 当前会话有效，修改会直接写入 SQLite</span><button className="quiet-button" onClick={() => logoutMutation.mutate()}><LogOut size={15} /> 退出</button></div>}
      {session.data?.authenticated && <div className="admin-tabs" role="tablist"><button className={tab === "categories" ? "active" : ""} onClick={() => setTab("categories")}><LayoutGrid size={16} /> 分类</button><button className={tab === "links" ? "active" : ""} onClick={() => setTab("links")}><Link2 size={16} /> 链接</button><button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}><SlidersHorizontal size={16} /> 站点设置</button></div>}
      {feedback && <div className="feedback-banner"><Check size={16} /> {feedback}<button onClick={() => setFeedback("")} aria-label="关闭提示"><X size={15} /></button></div>}
      {session.data?.authenticated && tab === "categories" && <div className="admin-grid"><section className="admin-section"><div className="section-title"><div><span className="eyebrow">目录结构</span><h2>分类</h2></div><button className="primary-button" onClick={() => { setEditingCategory(null); setCategoryName(""); setCategoryDescription(""); }}><Plus size={16} /> 新增分类</button></div><div className="admin-list">{data.categories.map((category) => <div className="admin-list-row" key={category.id}><span className="admin-drag">⋮⋮</span><span className="admin-item-icon"><ItemIcon icon={category.icon} size={18} /></span><span className="admin-item-copy"><strong>{category.name}</strong><small>{category.description} · {category.links.length} 个链接</small></span><button className="icon-button subtle" onClick={() => startCategoryEdit(category)} title="编辑分类"><Edit3 size={16} /></button><button className="icon-button subtle danger" onClick={() => categoryDelete.mutate(category.id)} title="删除分类"><Trash2 size={16} /></button></div>)}</div></section><CategoryForm editing={editingCategory} name={categoryName} description={categoryDescription} icon={categoryIcon} setName={setCategoryName} setDescription={setCategoryDescription} setIcon={setCategoryIcon} onSubmit={() => categoryMutation.mutate()} onCancel={() => setEditingCategory(null)} /></div>}
      {session.data?.authenticated && tab === "links" && <div className="admin-grid"><section className="admin-section"><div className="section-title"><div><span className="eyebrow">链接目录</span><h2>全部链接</h2></div><button className="primary-button" onClick={() => { setEditingLink(null); setLinkName(""); setLinkDescription(""); setLinkUrl(""); }}><Plus size={16} /> 新增链接</button></div><div className="admin-list">{data.categories.flatMap((category) => category.links.map((item) => ({ item, category }))).map(({ item, category }) => <div className="admin-list-row" key={item.id}><span className="admin-item-icon"><ItemIcon icon={item.icon} size={18} /></span><span className="admin-item-copy"><strong>{item.name}</strong><small>{category.name} · {item.url}</small></span><button className="icon-button subtle" onClick={() => startLinkEdit(item)} title="编辑链接"><Edit3 size={16} /></button><button className="icon-button subtle danger" onClick={() => linkDelete.mutate(item.id)} title="删除链接"><Trash2 size={16} /></button></div>)}</div></section><LinkForm editing={editingLink} name={linkName} description={linkDescription} url={linkUrl} categoryId={linkCategory} categories={data.categories} setName={setLinkName} setDescription={setLinkDescription} setUrl={setLinkUrl} setCategoryId={setLinkCategory} onSubmit={() => linkMutation.mutate()} onCancel={() => setEditingLink(null)} /></div>}
      {session.data?.authenticated && tab === "settings" && <SettingsPanel data={data} />}
    </main>
  );
}

function CategoryForm({ editing, name, description, icon, setName, setDescription, setIcon, onSubmit, onCancel }: { editing: Category | null; name: string; description: string; icon: string; setName: (value: string) => void; setDescription: (value: string) => void; setIcon: (value: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return <section className="editor-panel"><div className="section-title"><div><span className="eyebrow">{editing ? "编辑分类" : "新建分类"}</span><h2>{editing ? editing.name : "添加一个分类"}</h2></div></div><label>名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：设计资源" /></label><label>描述<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="一句话说明这个分类" /></label><label>图标<select value={icon} onChange={(event) => setIcon(event.target.value)}><option value="folder">文件夹</option><option value="star">星标</option><option value="code">开发</option><option value="wrench">工具</option><option value="newspaper">资讯</option><option value="cloud">云服务</option></select></label><div className="form-actions"><button className="quiet-button" onClick={onCancel}>取消</button><button className="primary-button" onClick={onSubmit} disabled={!name.trim()}><Check size={16} /> 保存分类</button></div></section>;
}

function LinkForm({ editing, name, description, url, categoryId, categories, setName, setDescription, setUrl, setCategoryId, onSubmit, onCancel }: { editing: LinkItem | null; name: string; description: string; url: string; categoryId: number; categories: Category[]; setName: (value: string) => void; setDescription: (value: string) => void; setUrl: (value: string) => void; setCategoryId: (value: number) => void; onSubmit: () => void; onCancel: () => void }) {
  return <section className="editor-panel"><div className="section-title"><div><span className="eyebrow">{editing ? "编辑链接" : "新建链接"}</span><h2>{editing ? editing.name : "添加一个链接"}</h2></div></div><label>名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：Notion" /></label><label>描述<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="简短的用途描述" /></label><label>地址<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" inputMode="url" /></label><label>所属分类<select value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><div className="form-actions"><button className="quiet-button" onClick={onCancel}>取消</button><button className="primary-button" onClick={onSubmit} disabled={!name.trim() || !url.trim()}><Check size={16} /> 保存链接</button></div></section>;
}

function SettingsPanel({ data }: { data: BootstrapData }) {
  const queryClient = useQueryClient();
  const [brandName, setBrandName] = useState(data.brand.name);
  const [brandDescription, setBrandDescription] = useState(data.brand.description);
  const [defaultEngine, setDefaultEngine] = useState(data.settings.defaultEngine);
  const [weatherLocation, setWeatherLocation] = useState(data.settings.weatherLocation);
  const [timezone, setTimezone] = useState(data.settings.timezone);
  const mutation = useMutation({
    mutationFn: () => updateSettings({ brandName, brandDescription, defaultEngine, weatherLocation, timezone }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bootstrap"] }),
  });
  return <section className="settings-form"><div className="section-title"><div><span className="eyebrow">站点偏好</span><h2>站点设置</h2></div><button className="primary-button" onClick={() => mutation.mutate()} disabled={mutation.isPending}><Check size={16} /> {mutation.isPending ? "保存中" : "保存设置"}</button></div><div className="settings-grid"><label>站点名称<input value={brandName} onChange={(event) => setBrandName(event.target.value)} /></label><label>默认搜索引擎<select value={defaultEngine} onChange={(event) => setDefaultEngine(event.target.value)}>{engineOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>天气城市<input value={weatherLocation} onChange={(event) => setWeatherLocation(event.target.value)} /></label><label>默认时区<input value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label><label className="settings-wide">副标题<input value={brandDescription} onChange={(event) => setBrandDescription(event.target.value)} /></label></div><div className="settings-note"><CircleHelp size={17} /><span>天气、订阅和服务监测由 Go 后台定时刷新，首页只读取本地缓存。</span></div></section>;
}

export { App };
