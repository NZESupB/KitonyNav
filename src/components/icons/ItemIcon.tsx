import { useState } from "react";
import type { IconType } from "react-icons";
import {
  Activity, BookOpen, Braces, BriefcaseBusiness, Clock3, Cloud, Code2, Coffee,
  Folder, Globe2, Image, Languages, Link2, MapPin, Music2, Newspaper, Palette,
  Plane, QrCode, Rss, Sparkles, Star, Wallet, Wrench, type LucideIcon,
} from "lucide-react";
import {
  SiBaidu, SiBilibili, SiCloudflare, SiDocker, SiFigma, SiGitee, SiGithub,
  SiGitea, SiGoogle, SiJetbrains, SiMdnwebdocs, SiNetlify, SiNpm, SiNotion,
  SiOpenai, SiPostman, SiReact, SiStackoverflow, SiVercel, SiYoutube,
} from "react-icons/si";

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

const uiIcons: Record<string, LucideIcon> = {
  folder: Folder,
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

export const iconOptions = [...Object.keys(uiIcons), ...Object.keys(brandIcons)];

type ItemIconProps = {
  icon: string;
  iconKind?: "builtin" | "url";
  iconUrl?: string;
  size?: number;
};

export function ItemIcon({ icon, iconKind = "builtin", iconUrl, size = 20 }: ItemIconProps) {
  if (iconKind === "url" && iconUrl) return <CustomIcon key={iconUrl} icon={icon} iconUrl={iconUrl} size={size} />;
  const BrandIcon = brandIcons[icon];
  if (BrandIcon) return <BrandIcon size={size} aria-hidden="true" />;
  const UiIcon = uiIcons[icon] ?? Link2;
  return <UiIcon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function CustomIcon({ icon, iconUrl, size }: { icon: string; iconUrl: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ItemIcon icon={icon} size={size} />;
  return <img className="custom-icon" src={iconUrl} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />;
}
