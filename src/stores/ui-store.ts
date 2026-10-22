import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Theme = "system" | "light" | "dark";
export const UI_STORAGE_KEY = "kitony-ui";
type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Preferences = { theme: Theme | null; collapsed: boolean };
type UIState = Preferences & {
  activeCategory: number | null;
  mobileMenuOpen: boolean;
  setTheme: (theme: Theme) => void;
  setCollapsed: (collapsed: boolean) => void;
  setActiveCategory: (activeCategory: number | null) => void;
  setMobileMenuOpen: (mobileMenuOpen: boolean) => void;
};

function preferences(value: unknown): Preferences {
  const saved = value && typeof value === "object" ? value as Partial<Preferences> : {};
  return {
    theme: saved.theme === "light" || saved.theme === "dark" || saved.theme === "system" ? saved.theme : null,
    collapsed: saved.collapsed === true,
  };
}

function browserStorage() {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    console.warn("本地存储不可用，界面偏好仅在当前页面生效。");
    return undefined;
  }
}

export function createUIStore(storage: PreferenceStorage | undefined = browserStorage()) {
  const preferenceStorage = {
    getItem(name: string) {
      try {
        const saved = storage?.getItem(name);
        if (saved != null) return saved;
        // 旧键只在尚无新版偏好时读取，未选择主题的设备继续采用站点默认值。
        return JSON.stringify({
          state: preferences({ theme: storage?.getItem("kitony-theme"), collapsed: storage?.getItem("kitony-sidebar") === "collapsed" }),
          version: 1,
        });
      } catch {
        console.warn("无法读取界面偏好，将使用默认值。");
        return null;
      }
    },
    setItem(name: string, value: string) {
      try {
        storage?.setItem(name, value);
      } catch {
        console.warn("无法保存界面偏好，当前页面的选择仍然生效。");
      }
    },
    removeItem(name: string) {
      try {
        storage?.removeItem(name);
      } catch {
        console.warn("无法清除已保存的界面偏好。");
      }
    },
  };

  return create<UIState>()(
    persist(
      (set) => ({
        theme: null,
        collapsed: false,
        activeCategory: null,
        mobileMenuOpen: false,
        setTheme: (theme) => set({ theme }),
        setCollapsed: (collapsed) => set({ collapsed }),
        setActiveCategory: (activeCategory) => set({ activeCategory }),
        setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
      }),
      {
        name: UI_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage<Preferences>(() => preferenceStorage),
        partialize: ({ theme, collapsed }) => ({ theme, collapsed }),
        merge: (saved, current) => ({ ...current, ...preferences(saved) }),
        migrate: (saved) => preferences(saved),
        onRehydrateStorage: () => (_state, error) => {
          if (error) console.warn("无法恢复界面偏好，将使用默认值。");
        },
      },
    ),
  );
}

export const useUIStore = createUIStore();
