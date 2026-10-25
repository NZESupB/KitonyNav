import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePageVisible } from "./use-page-visible";

const ClockContext = createContext<Date | null>(null);

/**
 * 全局共享时钟 Provider
 * 统一受可见性控制：页面隐藏时停止计时器，恢复可见时立刻校时，避免后台无谓唤醒与时间漂移
 */
export function ClockProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState<Date>(() => new Date());
  const isVisible = usePageVisible();

  useEffect(() => {
    if (!isVisible) {
      // 页面隐藏时暂停计时器
      return;
    }

    // 恢复可见时立即校时
    setNow(new Date());

    // 开启每秒定时器
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isVisible]);

  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}

/**
 * 获取共享当前时间的 Hook
 */
export function useClock(): Date {
  const context = useContext(ClockContext);
  if (context === null) throw new Error("useClock 必须在 ClockProvider 内使用");
  return context;
}
