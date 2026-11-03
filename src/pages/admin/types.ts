import type { LinkIconKind } from "../../lib/icons";
import type { Subscription } from "../../data";

export type AdminFeedback = {
  kind: "success" | "error";
  message: string;
};

export type CategoryDraft = {
  name: string;
  description: string;
  icon: string;
  iconKind: "builtin" | "url";
  iconUrl: string;
};

export const emptyCategoryDraft: CategoryDraft = {
  name: "",
  description: "",
  icon: "folder",
  iconKind: "builtin",
  iconUrl: "",
};

export type LinkDraft = {
  name: string;
  description: string;
  url: string;
  icon: string;
  iconKind: LinkIconKind;
  iconUrl: string;
  connectivityEnabled: boolean;
  categoryId: number;
};

export const emptyLinkDraft: LinkDraft = {
  name: "",
  description: "",
  url: "",
  icon: "globe",
  iconKind: "builtin",
  iconUrl: "",
  connectivityEnabled: true,
  categoryId: 0,
};

export type ServiceDraft = {
  name: string;
  enabled: boolean;
  target: string;
};

export const emptyServiceDraft: ServiceDraft = {
  name: "",
  enabled: true,
  target: "",
};

export type SubscriptionDraft = {
  type: Subscription["type"];
  name: string;
  url: string;
  enabled: boolean;
  intervalSeconds: string;
};

export const emptySubscriptionDraft: SubscriptionDraft = {
  type: "rss",
  name: "",
  url: "",
  enabled: true,
  intervalSeconds: "900",
};
