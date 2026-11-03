import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Tabs } from "radix-ui";
import {
  Activity,
  Check,
  CircleAlert,
  LayoutGrid,
  Link2,
  LogIn,
  LogOut,
  Rss,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { fetchSession, login, logout } from "../api";
import type { BootstrapData } from "../data";
import { CategoriesTab } from "./admin/CategoriesTab";
import { LinksTab } from "./admin/LinksTab";
import { ServicesTab } from "./admin/ServicesTab";
import { SubscriptionsTab } from "./admin/SubscriptionsTab";
import { SettingsPanel } from "./admin/SettingsPanel";
import type { AdminFeedback } from "./admin/types";

export default function AdminPage({ data }: { data: BootstrapData }) {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: fetchSession, staleTime: 10_000 });
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<"categories" | "links" | "services" | "subscriptions" | "settings">("categories");
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => login(password),
    onSuccess: () => {
      setPassword("");
      setLoginError("");
      queryClient.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (error: Error) => setLoginError(error.message || "登录失败"),
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
  });

  return (
    <motion.main
      className="page-content admin-page route-page-container"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="page-heading">
        <div>
          <span className="eyebrow">管理控制台</span>
          <h1>设置</h1>
          <p>内容保存后立即生效；服务和订阅按配置刷新。</p>
        </div>
        <div className={`admin-status ${session.data?.authenticated ? "" : "is-locked"}`}>
          {session.data?.authenticated ? (
            <>
              <ShieldCheck size={16} /> 已登录
            </>
          ) : (
            <>
              <LogIn size={16} /> 需要登录
            </>
          )}
        </div>
      </div>

      {!session.data?.authenticated && (
        <form
          className="admin-login"
          onSubmit={(event) => {
            event.preventDefault();
            loginMutation.mutate();
          }}
        >
          <div>
            <span className="eyebrow">管理员访问</span>
            <h2>登录后编辑导航</h2>
            <p>公开页面无需登录，只有保存配置时需要管理员会话。</p>
          </div>
          <div className="admin-login-fields">
            <label>
              <span className="visually-hidden">管理员密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入管理员密码"
                autoComplete="current-password"
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={!password || loginMutation.isPending}
            >
              <LogIn size={16} /> {loginMutation.isPending ? "登录中" : "登录"}
            </button>
          </div>
          {loginError && <span className="login-error">{loginError}</span>}
        </form>
      )}

      {session.error && (
        <p className="settings-error" role="alert">
          无法确认登录状态：{session.error.message}
        </p>
      )}

      {session.data?.authenticated && (
        <div className="admin-account-bar">
          <span>
            <Check size={15} /> 当前会话有效，修改会直接写入 SQLite
          </span>
          <button
            type="button"
            className="quiet-button"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut size={15} /> 退出
          </button>
        </div>
      )}

      {session.data?.authenticated && (
        <Tabs.Root value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <Tabs.List className="admin-tabs" aria-label="管理分区">
            {[
              { id: "categories", label: "分类", icon: <LayoutGrid size={16} /> },
              { id: "links", label: "链接", icon: <Link2 size={16} /> },
              { id: "services", label: "服务状态", icon: <Activity size={16} /> },
              { id: "subscriptions", label: "动态订阅", icon: <Rss size={16} /> },
              { id: "settings", label: "外观", icon: <SlidersHorizontal size={16} /> },
            ].map((item) => (
              <Tabs.Trigger
                value={item.id}
                className={tab === item.id ? "active" : ""}
                key={item.id}
              >
                {tab === item.id && (
                  <motion.span
                    layoutId="active-admin-tab"
                    className="tab-pill-active"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                  />
                )}
                {item.icon}
                <span>{item.label}</span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {feedback && (
            <div
              className={`feedback-banner ${feedback.kind}`}
              role={feedback.kind === "error" ? "alert" : "status"}
            >
              {feedback.kind === "error" ? <CircleAlert size={16} /> : <Check size={16} />}
              <span>{feedback.message}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="关闭提示"
              >
                <X size={15} />
              </button>
            </div>
          )}

          <Tabs.Content value={tab}>
            {tab === "categories" && <CategoriesTab data={data} onFeedback={setFeedback} />}
            {tab === "links" && <LinksTab data={data} onFeedback={setFeedback} />}
            {tab === "services" && <ServicesTab data={data} onFeedback={setFeedback} />}
            {tab === "subscriptions" && <SubscriptionsTab data={data} onFeedback={setFeedback} />}
            {tab === "settings" && <SettingsPanel data={data} onFeedback={setFeedback} />}
          </Tabs.Content>
        </Tabs.Root>
      )}
    </motion.main>
  );
}
