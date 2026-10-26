import { useId } from "react";
import { clockStyles, dateStyles, defaultAppearance, type AppearanceSettings } from "../../lib/appearance";
import { ClockDateWidget } from "./ClockDateWidget";
import { ThemedSelect } from "../ui/ThemedSelect";

export function ClockSettings({ appearance, onChange, timezone }: { appearance: AppearanceSettings; onChange: (value: AppearanceSettings) => void; timezone?: string }) {
  const id = useId();
  const update = (value: Partial<AppearanceSettings>) => onChange({ ...appearance, ...value });
  return <section className="clock-settings" aria-label="时钟与日期设置">
    <div className="clock-settings-heading"><h3>时钟与日期</h3><button type="button" className="quiet-button" onClick={() => onChange({ ...defaultAppearance, theme: appearance.theme })}>恢复时钟默认</button></div>
    <div className="settings-grid">
      <label htmlFor={`${id}-clock`}>时钟样式<ThemedSelect id={`${id}-clock`} aria-label="时钟样式" value={appearance.clockStyle} onValueChange={(value) => update({ clockStyle: value as AppearanceSettings["clockStyle"] })} options={clockStyles} /></label>
      <label htmlFor={`${id}-date`}>日期主题<ThemedSelect id={`${id}-date`} aria-label="日期主题" value={appearance.dateStyle} onValueChange={(value) => update({ dateStyle: value as AppearanceSettings["dateStyle"] })} options={dateStyles} /></label>
      <label className="checkbox-row"><input type="checkbox" checked={appearance.clock24Hour} onChange={(event) => update({ clock24Hour: event.target.checked })} />24 小时制</label>
      <label className="checkbox-row"><input type="checkbox" checked={appearance.clockSeconds} onChange={(event) => update({ clockSeconds: event.target.checked })} />显示秒数</label>
      <label>时钟颜色<input type="color" value={appearance.clockColor} onChange={(event) => update({ clockColor: event.target.value })} /></label>
      <label>动画速度<ThemedSelect aria-label="动画速度" value={String(appearance.clockSpeed)} onValueChange={(value) => update({ clockSpeed: Number(value) })} options={[1, 2, 3].map((speed) => ({ value: String(speed), label: `${speed} 档` }))} /></label>
    </div>
    <div className="clock-preview"><span>实时预览</span><ClockDateWidget appearance={appearance} timezone={timezone} /></div>
  </section>;
}
