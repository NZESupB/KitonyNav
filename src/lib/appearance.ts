export type ClockStyle = "plain" | "flip" | "ticker" | "glow" | "lcd" | "analog";
export type DateStyle = "compact" | "lunar" | "card";

export type AppearanceSettings = {
  theme: "system" | "light" | "dark";
  clockStyle: ClockStyle;
  dateStyle: DateStyle;
  clock24Hour: boolean;
  clockSeconds: boolean;
  clockColor: string;
  clockSpeed: number;
};

export const clockStyles: { value: ClockStyle; label: string }[] = [
  { value: "plain", label: "标准" },
  { value: "flip", label: "翻页" },
  { value: "ticker", label: "滚动" },
  { value: "glow", label: "柔和发光" },
  { value: "lcd", label: "LCD 数字" },
  { value: "analog", label: "紧凑表盘" },
];

export const dateStyles: { value: DateStyle; label: string }[] = [
  { value: "compact", label: "紧凑" },
  { value: "lunar", label: "公历与农历" },
  { value: "card", label: "日期卡片" },
];

export const defaultAppearance: AppearanceSettings = {
  theme: "system", clockStyle: "plain", dateStyle: "compact", clock24Hour: true,
  clockSeconds: true, clockColor: "#2f6ff3", clockSpeed: 1,
};

export function normalizeAppearance(value?: Partial<AppearanceSettings>): AppearanceSettings {
  return {
    theme: value?.theme === "light" || value?.theme === "dark" ? value.theme : "system",
    clockStyle: clockStyles.some((style) => style.value === value?.clockStyle) ? value!.clockStyle! : "plain",
    dateStyle: dateStyles.some((style) => style.value === value?.dateStyle) ? value!.dateStyle! : "compact",
    clock24Hour: value?.clock24Hour !== false,
    clockSeconds: value?.clockSeconds !== false,
    clockColor: /^#[0-9a-f]{6}$/i.test(value?.clockColor ?? "") ? value!.clockColor! : defaultAppearance.clockColor,
    clockSpeed: Math.min(3, Math.max(1, Math.round(Number(value?.clockSpeed) || 1))),
  };
}
