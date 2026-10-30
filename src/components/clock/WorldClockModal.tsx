import type { ReactNode } from "react";
import { Dialog } from "radix-ui";
import { Globe2, Moon, Sun, X } from "lucide-react";
import { useClock } from "../../hooks/use-clock";
import { safeTimezone } from "../../lib/time";

type CityTimezone = {
  city: string;
  country: string;
  timezone: string;
  label: string;
};

const WORLD_CITIES: CityTimezone[] = [
  { city: "北京", country: "中国", timezone: "Asia/Shanghai", label: "CST (UTC+8)" },
  { city: "东京", country: "日本", timezone: "Asia/Tokyo", label: "JST (UTC+9)" },
  { city: "伦敦", country: "英国", timezone: "Europe/London", label: "GMT / BST" },
  { city: "巴黎", country: "法国", timezone: "Europe/Paris", label: "CET / CEST" },
  { city: "纽约", country: "美国", timezone: "America/New_York", label: "EST / EDT" },
  { city: "旧金山", country: "美国", timezone: "America/Los_Angeles", label: "PST / PDT" },
];

function getTimezoneParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const find = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const hour = parseInt(find("hour"), 10) || 0;
  const minute = parseInt(find("minute"), 10) || 0;
  const second = parseInt(find("second"), 10) || 0;
  const weekday = find("weekday");

  const weekdaysZh: Record<string, string> = {
    Mon: "周一", Tue: "周二", Wed: "周三", Thu: "周四", Fri: "周五", Sat: "周六", Sun: "周日",
  };

  return {
    hour,
    minute,
    second,
    offsetMinutes: (Date.UTC(Number(find("year")), Number(find("month")) - 1, Number(find("day")), hour, minute, second) - Math.floor(date.getTime() / 1000) * 1000) / 60_000,
    weekdayZh: weekdaysZh[weekday] || weekday,
    isDay: hour >= 6 && hour < 18,
    timeString: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`,
  };
}

function getTimeDiffLabel(target: { offsetMinutes: number }, base: { offsetMinutes: number }) {
  const diffHours = (target.offsetMinutes - base.offsetMinutes) / 60;
  if (diffHours === 0) return "本地时间";
  return `${diffHours > 0 ? "+" : ""}${diffHours} 小时`;
}

export function WorldClockModal({
  open,
  onOpenChange,
  baseTimezone,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseTimezone?: string;
  trigger: ReactNode;
}) {
  const now = useClock();
  const localZone = safeTimezone(baseTimezone) || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
  const localParts = getTimezoneParts(now, localZone);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="world-clock-overlay" />
        <Dialog.Content className="world-clock-dialog">
          <div className="world-clock-header">
            <div className="world-clock-title-area">
              <span className="world-clock-badge">
                <Globe2 size={16} /> 世界时钟
              </span>
              <Dialog.Title className="world-clock-heading">全球多时区模拟表盘</Dialog.Title>
              <Dialog.Description className="visually-hidden">查看六个城市的当前时间及其与基准时区的时差。</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button subtle" aria-label="关闭世界时钟">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="world-clock-grid">
            {WORLD_CITIES.map((item) => {
              const parts = getTimezoneParts(now, item.timezone);
              const diff = getTimeDiffLabel(parts, localParts);

              const hourDeg = (parts.hour % 12) * 30 + parts.minute * 0.5;
              const minDeg = parts.minute * 6 + parts.second * 0.1;
              const secDeg = parts.second * 6;

              return (
                <div className={`world-clock-card ${parts.isDay ? "day" : "night"}`} key={item.timezone}>
                  <div className="world-clock-meta">
                    <div className="world-clock-city">
                      <strong>{item.city}</strong>
                      <small>{item.country} · {item.label}</small>
                    </div>
                    <span className={`world-clock-daynight ${parts.isDay ? "is-day" : "is-night"}`} title={parts.isDay ? "白天" : "夜晚"}>
                      {parts.isDay ? <Sun size={14} /> : <Moon size={14} />}
                      <span>{diff}</span>
                    </span>
                  </div>

                  <div className="analog-dial-wrapper">
                    <div className="analog-dial">
                      <div className="analog-dial-face">
                        {/* 12 个时钟主要刻度 */}
                        {Array.from({ length: 12 }, (_, i) => (
                          <span
                            key={i}
                            className={`analog-mark ${i % 3 === 0 ? "major" : "minor"}`}
                            style={{ transform: `rotate(${i * 30}deg)` }}
                          />
                        ))}

                        {/* 指针 */}
                        <div
                          className="analog-hand analog-hand-hour"
                          style={{ transform: `rotate(${hourDeg}deg)` }}
                        />
                        <div
                          className="analog-hand analog-hand-minute"
                          style={{ transform: `rotate(${minDeg}deg)` }}
                        />
                        <div
                          className="analog-hand analog-hand-second"
                          style={{ transform: `rotate(${secDeg}deg)` }}
                        />

                        {/* 表盘中心轴套 */}
                        <div className="analog-center-cap" />
                      </div>
                    </div>
                  </div>

                  <div className="world-clock-digital">
                    <span className="digital-time">{parts.timeString}</span>
                    <span className="digital-weekday">{parts.weekdayZh}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="world-clock-footer">
            <span>基准时区：{localZone}</span>
            <small>秒针同步走动 · 随系统时钟精确计时</small>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
