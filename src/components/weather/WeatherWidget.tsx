import { useMemo } from "react";
import { Popover } from "radix-ui";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudOff,
  CloudRain,
  CloudSnow,
  CloudSun,
  Compass,
  Droplets,
  Moon,
  RefreshCw,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react";
import { useWeather } from "../../hooks/use-weather";
import { describeWeather, type WeatherIconType } from "../../lib/weather";
import { cachedDateTimeFormat } from "../../lib/time";

function WeatherIcon({
  type,
  size = 19,
  className,
}: {
  type: WeatherIconType;
  size?: number;
  className?: string;
}) {
  switch (type) {
    case "sun":
      return <Sun size={size} className={className} />;
    case "moon":
      return <Moon size={size} className={className} />;
    case "cloud-sun":
      return <CloudSun size={size} className={className} />;
    case "cloud-moon":
      return <CloudMoon size={size} className={className} />;
    case "cloud":
      return <Cloud size={size} className={className} />;
    case "fog":
      return <CloudFog size={size} className={className} />;
    case "drizzle":
      return <CloudDrizzle size={size} className={className} />;
    case "rain":
      return <CloudRain size={size} className={className} />;
    case "snow":
      return <CloudSnow size={size} className={className} />;
    case "storm":
      return <CloudLightning size={size} className={className} />;
    default:
      return <Cloud size={size} className={className} />;
  }
}

function formatObservedTime(observedAt: string): string {
  try {
    const date = new Date(observedAt);
    if (Number.isNaN(date.getTime())) return observedAt;
    return cachedDateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return observedAt;
  }
}

export function WeatherWidget({ fallbackCity }: { fallbackCity?: string }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useWeather(fallbackCity);

  const weatherDesc = useMemo(() => {
    if (!data) return null;
    return describeWeather(data.code, data.isDay);
  }, [data]);

  const placeName = data?.place || fallbackCity?.trim() || "当前位置";
  const hasData = Boolean(data && weatherDesc);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="weather-inline weather-trigger"
          aria-label="天气详情"
          title={!hasData && isError ? (error?.message || "天气不可用") : `${placeName}天气`}
        >
          {hasData && data && weatherDesc ? (
            <>
              <WeatherIcon type={weatherDesc.icon} size={18} className="weather-icon-active" />
              <span className="weather-place">{data.place}</span>
              <strong className="weather-temp">{Math.round(data.temperature)}°C</strong>
              <em className="weather-condition">{weatherDesc.label}</em>
            </>
          ) : isLoading ? (
            <>
              <Cloud size={18} className="weather-icon-loading" />
              <span className="weather-skeleton-pill">{placeName}</span>
              <em className="weather-skeleton-pill short">加载中</em>
            </>
          ) : (
            <>
              <CloudOff size={18} />
              <span>{placeName}</span>
              <em>天气不可用</em>
            </>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="weather-popover"
          side="bottom"
          sideOffset={8}
          collisionPadding={12}
          aria-label="天气详情面板"
        >
          {hasData && data && weatherDesc ? (
            <div className="weather-popover-content">
              {/* 顶部：大号温度 + 天气图标 + 地点与描述 */}
              <div className="weather-hero">
                <div className="weather-hero-left">
                  <div className="weather-hero-temp">
                    <span className="weather-hero-degrees">{Math.round(data.temperature)}</span>
                    <span className="weather-hero-unit">°C</span>
                  </div>
                  <div className="weather-hero-meta">
                    <h4 className="weather-hero-place">{data.place}</h4>
                    <p className="weather-hero-desc">{weatherDesc.label}</p>
                  </div>
                </div>
                <div className="weather-hero-icon-slot">
                  <WeatherIcon type={weatherDesc.icon} size={36} className="weather-hero-icon" />
                </div>
              </div>

              {/* 2 列指标小瓦片（体感、湿度、风速、今日温差） */}
              <div className="weather-tiles-grid">
                <div className="weather-tile">
                  <div className="weather-tile-header">
                    <Thermometer size={14} className="weather-tile-icon" />
                    <span className="weather-tile-label">体感温度</span>
                  </div>
                  <strong className="weather-tile-value">{Math.round(data.apparentTemperature)}°C</strong>
                </div>

                <div className="weather-tile">
                  <div className="weather-tile-header">
                    <Droplets size={14} className="weather-tile-icon" />
                    <span className="weather-tile-label">相对湿度</span>
                  </div>
                  <strong className="weather-tile-value">{Math.round(data.humidity)}%</strong>
                </div>

                <div className="weather-tile">
                  <div className="weather-tile-header">
                    <Wind size={14} className="weather-tile-icon" />
                    <span className="weather-tile-label">风速</span>
                  </div>
                  <strong className="weather-tile-value">{Math.round(data.windSpeed)} km/h</strong>
                </div>

                <div className="weather-tile">
                  <div className="weather-tile-header">
                    <Compass size={14} className="weather-tile-icon" />
                    <span className="weather-tile-label">今日温差</span>
                  </div>
                  <strong className="weather-tile-value">
                    {Math.round(data.min)}° ~ {Math.round(data.max)}°C
                  </strong>
                </div>
              </div>

              {/* 后台刷新失败时轻量警告与重试 */}
              {isError && (
                <div className="weather-refresh-error" role="alert">
                  <span className="weather-refresh-error-text">
                    刷新失败：{error?.message || "网络异常"}
                  </span>
                  <button
                    type="button"
                    className="weather-mini-retry"
                    onClick={() => void refetch()}
                    disabled={isFetching}
                  >
                    <RefreshCw size={12} className={isFetching ? "spin" : ""} /> 重试
                  </button>
                </div>
              )}

              {/* 底部一行：定位/城市 · 观测时间 · 数据源 + 刷新按钮 */}
              <div className="weather-popover-footer">
                <span className="weather-source-text">
                  {data.source === "ip" ? "按 IP 定位" : "按设置城市"} · 观测 {formatObservedTime(data.observedAt)} · Open-Meteo
                </span>
                <button
                  type="button"
                  className="icon-button subtle weather-refresh-btn"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  title="刷新天气"
                  aria-label="刷新天气"
                >
                  <RefreshCw size={14} className={isFetching ? "spin" : ""} />
                </button>
              </div>
            </div>
          ) : isLoading ? (
            /* 加载中骨架态 */
            <div className="weather-skeleton-card" aria-label="天气数据加载中">
              <div className="weather-skeleton-hero">
                <div className="weather-skeleton-block hero-temp" />
                <div className="weather-skeleton-block hero-icon" />
              </div>
              <div className="weather-tiles-grid">
                <div className="weather-tile skeleton"><div className="weather-skeleton-block" /></div>
                <div className="weather-tile skeleton"><div className="weather-skeleton-block" /></div>
                <div className="weather-tile skeleton"><div className="weather-skeleton-block" /></div>
                <div className="weather-tile skeleton"><div className="weather-skeleton-block" /></div>
              </div>
              <div className="weather-skeleton-block footer-line" />
            </div>
          ) : (
            /* 纯错误态（无数据且报错） */
            <div className="weather-popover-error">
              <CloudOff size={28} className="weather-error-icon" />
              <p>{error?.message || "无法获取天气数据"}</p>
              <button
                type="button"
                className="primary-button weather-retry-btn"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                <RefreshCw size={14} className={isFetching ? "spin" : ""} /> 重新加载
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
