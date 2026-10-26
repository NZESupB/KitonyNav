import { useState } from "react";
import type { IconType } from "react-icons";
import { getWebsiteIconCandidates, type LinkIconKind } from "../../lib/icons";
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
  iconKind?: LinkIconKind;
  iconUrl?: string;
  websiteUrl?: string;
  size?: number;
};

export function ItemIcon({ icon, iconKind = "builtin", iconUrl, websiteUrl, size = 20 }: ItemIconProps) {
  const candidates = iconKind === "website" ? getWebsiteIconCandidates(websiteUrl ?? "") : iconKind === "url" && iconUrl ? [iconUrl] : [];
  if (candidates.length) return <CustomIcon key={`${iconKind}:${iconKind === "website" ? websiteUrl : iconUrl}:${JSON.stringify(candidates)}`} icon={icon} candidates={candidates} size={size} />;
  const BrandIcon = brandIcons[icon];
  if (BrandIcon) return <BrandIcon size={size} aria-hidden="true" />;
  const UiIcon = uiIcons[icon] ?? Link2;
  return <UiIcon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function CustomIcon({ icon, candidates, size }: { icon: string; candidates: string[]; size: number }) {
  const [index, setIndex] = useState(0);
  if (index >= candidates.length) return <ItemIcon icon={icon} size={size} />;
  return <img key={candidates[index]} className="custom-icon" src={candidates[index]} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setIndex((previous) => previous + 1)} />;
}
