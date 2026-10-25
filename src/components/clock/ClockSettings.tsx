import { useId } from "react";
import { clockStyles, dateStyles, defaultAppearance, type AppearanceSettings } from "../../lib/appearance";
import { ClockDateWidget } from "./ClockDateWidget";

export function ClockSettings({ appearance, onChange, timezone }: { appearance: AppearanceSettings; onChange: (value: AppearanceSettings) => void; timezone?: string }) {
  const id = useId();
  const update = (value: Partial<AppearanceSettings>) => onChange({ ...appearance, ...value });
  return <section className="clock-settings" aria-label="时钟与日期设置">
    <div className="clock-settings-heading"><h3>时钟与日期</h3><button type="button" className="quiet-button" onClick={() => onChange({ ...defaultAppearance, theme: appearance.theme })}>恢复时钟默认</button></div>
    <div className="settings-grid">
      <label htmlFor={`${id}-clock`}>时钟样式<select id={`${id}-clock`} value={appearance.clockStyle} onChange={(event) => update({ clockStyle: event.target.value as AppearanceSettings["clockStyle"] })}>{clockStyles.map((style) => <option value={style.value} key={style.value}>{style.label}</option>)}</select></label>
      <label htmlFor={`${id}-date`}>日期主题<select id={`${id}-date`} value={appearance.dateStyle} onChange={(event) => update({ dateStyle: event.target.value as AppearanceSettings["dateStyle"] })}>{dateStyles.map((style) => <option value={style.value} key={style.value}>{style.label}</option>)}</select></label>
      <label className="checkbox-row"><input type="checkbox" checked={appearance.clock24Hour} onChange={(event) => update({ clock24Hour: event.target.checked })} />24 小时制</label>
      <label className="checkbox-row"><input type="checkbox" checked={appearance.clockSeconds} onChange={(event) => update({ clockSeconds: event.target.checked })} />显示秒数</label>
      <label>时钟颜色<input type="color" value={appearance.clockColor} onChange={(event) => update({ clockColor: event.target.value })} /></label>
      <label>动画速度<select value={appearance.clockSpeed} onChange={(event) => update({ clockSpeed: Number(event.target.value) })}>{[1, 2, 3].map((speed) => <option value={speed} key={speed}>{speed} 档</option>)}</select></label>
    </div>
    <div className="clock-preview"><span>实时预览</span><ClockDateWidget appearance={appearance} timezone={timezone} /></div>
  </section>;
}
