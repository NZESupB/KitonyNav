import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CircleHelp } from "lucide-react";
import { updateSettings } from "../../api";
import { ClockSettings } from "../../components/clock/ClockSettings";
import { SearchEngineSelect } from "../../components/search/SearchEngineSelect";
import { FormControlsDisabled, ThemedSelect } from "../../components/ui/ThemedSelect";
import { normalizeAppearance } from "../../lib/appearance";
import type { Theme } from "../../stores/ui-store";
import type { BootstrapData } from "../../data";
import type { AdminFeedback } from "./types";

export function SettingsPanel({
  data,
  onFeedback,
}: {
  data: BootstrapData;
  onFeedback?: (feedback: AdminFeedback) => void;
}) {
  const queryClient = useQueryClient();
  const [brandName, setBrandName] = useState(data.brand.name);
  const [brandDescription, setBrandDescription] = useState(data.brand.description);
  const [defaultEngine, setDefaultEngine] = useState(data.settings.defaultEngine);
  const [weatherLocation, setWeatherLocation] = useState(data.settings.weatherLocation);
  const [timezone, setTimezone] = useState(data.settings.timezone);
  const [appearance, setAppearance] = useState(() => normalizeAppearance(data.settings.appearance));
  const [saveError, setSaveError] = useState("");

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      setSaveError("");
      onFeedback?.({ kind: "success", message: "外观设置已保存" });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (error: Error) => {
      const msg = error.message || "保存设置失败";
      setSaveError(msg);
      onFeedback?.({ kind: "error", message: msg });
    },
  });

  return (
    <FormControlsDisabled.Provider value={mutation.isPending}>
      <section className="settings-form">
        <fieldset className="admin-fields" disabled={mutation.isPending}>
          <div className="section-title">
            <div>
              <span className="eyebrow">站点偏好</span>
              <h2>外观与默认值</h2>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                mutation.mutate({
                  brandName,
                  brandDescription,
                  defaultEngine,
                  weatherLocation,
                  timezone,
                  ...appearance,
                })
              }
              disabled={mutation.isPending}
            >
              <Check size={16} />
              {mutation.isPending ? "保存中" : "保存设置"}
            </button>
          </div>
          <div className="settings-grid">
            <label>
              站点名称
              <input
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
              />
            </label>
            <label>
              默认搜索引擎
              <SearchEngineSelect
                value={defaultEngine}
                onValueChange={setDefaultEngine}
              />
            </label>
            <label>
              备用天气城市
              <input
                value={weatherLocation}
                onChange={(event) => setWeatherLocation(event.target.value)}
              />
              <small className="form-help">
                优先按访问者 IP 定位；定位失败时使用此城市
              </small>
            </label>
            <label>
              默认时区
              <input
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              />
            </label>
            <label className="settings-wide">
              站点说明
              <input
                value={brandDescription}
                onChange={(event) => setBrandDescription(event.target.value)}
                placeholder="可留空"
              />
            </label>
            <label>
              主题默认值
              <ThemedSelect
                aria-label="主题默认值"
                value={appearance.theme}
                onValueChange={(value) =>
                  setAppearance({ ...appearance, theme: value as Theme })
                }
                options={[
                  { value: "system", label: "跟随系统" },
                  { value: "light", label: "浅色" },
                  { value: "dark", label: "深色" },
                ]}
              />
            </label>
          </div>
          <ClockSettings
            appearance={appearance}
            onChange={setAppearance}
            timezone={timezone}
          />
        </fieldset>
        {saveError && (
          <p className="settings-error" role="alert">
            {saveError}
          </p>
        )}
        <div className="settings-note">
          <CircleHelp size={17} />
          <span>
            时区使用 IANA 名称，例如 Asia/Shanghai；点击日期打开万年历。主题选择仍可在主页覆盖站点默认值。
          </span>
        </div>
      </section>
    </FormControlsDisabled.Provider>
  );
}
