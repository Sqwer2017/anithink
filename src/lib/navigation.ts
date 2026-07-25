import {
  Home,
  Flame,
  Grid2x2,
  Library,
  PlayCircle,
  Newspaper,
  User,
  Settings,
  Bookmark,
  ListVideo,
  History,
  MessageSquare,
  Bell,
  Users,
  LogOut,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Левый сайдбар — основная навигация */
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/top", label: "Топ 10", icon: Flame },
  { href: "/genres", label: "Жанры", icon: Grid2x2 },
  { href: "/catalog", label: "Каталог", icon: Library },
  { href: "/ongoing", label: "Онгоинги", icon: PlayCircle },
  { href: "/news", label: "Новости", icon: Newspaper },
];

/** Правый сайдбар — профильные действия */
export interface ProfileNavItem extends NavItem {
  badge?: string;
}

export const PROFILE_NAV: ProfileNavItem[] = [
  { href: "/profile", label: "Профиль", icon: User },
  { href: "/settings", label: "Настройки", icon: Settings },
  { href: "/saved", label: "Сохраненки", icon: Bookmark },
  { href: "/playlists", label: "Плейлисты", icon: ListVideo },
  { href: "/history", label: "История", icon: History },
  { href: "/chat", label: "Чат", icon: MessageSquare },
  { href: "/notifications", label: "Уведомления", icon: Bell },
  { href: "/friends", label: "Друзья", icon: Users },
];

/** Иконка выхода — отдельная, не входит в основной список */
export const LOGOUT_NAV: NavItem = {
  href: "/logout",
  label: "Выйти",
  icon: LogOut,
};
