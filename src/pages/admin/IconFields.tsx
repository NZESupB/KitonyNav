import { useEffect, useState } from "react";
import { ItemIcon, iconOptions } from "../../components/icons/ItemIcon";
import { ThemedSelect } from "../../components/ui/ThemedSelect";
import type { LinkIconKind } from "../../lib/icons";

export function IconFields<T extends LinkIconKind>({
  icon,
  iconKind,
  iconUrl,
  websiteUrl,
  onChange,
}: {
  icon: string;
  iconKind: T;
  iconUrl: string;
  websiteUrl?: string;
  onChange: (patch: { icon?: string; iconKind?: T; iconUrl?: string }) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState(websiteUrl);
  useEffect(() => {
    const timer = setTimeout(() => setPreviewUrl(websiteUrl), 300);
    return () => clearTimeout(timer);
  }, [websiteUrl]);

  const sources = [
    { value: "builtin", label: "内置图标" },
    { value: "url", label: "图片地址" },
    ...(websiteUrl !== undefined ? [{ value: "website", label: "网站图标" }] : []),
  ];

  return (
    <div className="icon-fields">
      <label>
        图标来源
        <ThemedSelect
          aria-label="图标来源"
          value={iconKind}
          onValueChange={(value) => onChange({ iconKind: value as T })}
          options={sources}
        />
      </label>
      {iconKind === "builtin" && (
        <label>
          内置图标
          <ThemedSelect
            aria-label="内置图标"
            value={icon}
            onValueChange={(value) => onChange({ icon: value })}
            options={iconOptions.map((value) => ({ value, label: value }))}
          />
        </label>
      )}
      {iconKind === "url" && (
        <label>
          图片地址
          <input
            value={iconUrl}
            onChange={(event) => onChange({ iconUrl: event.target.value })}
            placeholder="https://..."
            inputMode="url"
          />
        </label>
      )}
      {iconKind === "website" && (
        <p className="form-empty">
          自动获取网站图标；未找到时使用内置图标。自定义 Logo 可使用图片地址。
        </p>
      )}
      <span className="icon-preview" aria-label="图标预览">
        <ItemIcon
          icon={icon}
          iconKind={iconKind}
          iconUrl={iconUrl}
          websiteUrl={previewUrl === websiteUrl ? previewUrl : undefined}
          size={20}
        />
      </span>
    </div>
  );
}
