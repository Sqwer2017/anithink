"use client";

import Link from "next/link";
import { Bell, Newspaper, PlayCircle, Trash2, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Notice { id: string; title: string; href: string; kind: "news" | "episode"; }
const SEEN_KEY = "anithink:notifications-seen";
const DISMISSED_KEY = "anithink:notifications-dismissed";

export function NotificationsClient() {
  const [items, setItems] = useState<Notice[]>([]); const [selected, setSelected] = useState<string[]>([]);
  // Предпочтение «уведомлять о новых сериях» (настройка приватности в БД).
  const [notifPref, setNotifPref] = useState<boolean | null>(null);
  useEffect(() => { void fetch("/api/notifications").then((response) => response.json()).then((data: { news: Notice[]; ongoing: Notice[] }) => { const hidden: unknown = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]"); const hiddenIds = new Set(Array.isArray(hidden) ? hidden : []); const next = [...data.news, ...data.ongoing].filter((item) => !hiddenIds.has(item.id)); setItems(next); window.localStorage.setItem(SEEN_KEY, JSON.stringify(next.map((item) => item.id))); window.dispatchEvent(new Event("anithink:notifications-read")); }).catch(() => {}); }, []);
  // Читаем флаг уведомлений у текущего пользователя.
  useEffect(() => {
    if (!supabase) { setNotifPref(false); return; }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) { if (!cancelled) setNotifPref(false); return; }
      const { data: prof } = await supabase
        .from("profiles")
        .select("new_episode_notif")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setNotifPref(Boolean(prof?.new_episode_notif));
    })();
    return () => { cancelled = true; };
  }, []);

  const remove = (ids: string[]) => { const dismissed: unknown = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]"); const next = [...new Set([...(Array.isArray(dismissed) ? dismissed : []), ...ids])]; const remaining = items.filter((item) => !ids.includes(item.id)); window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); setItems(remaining); setSelected([]); window.dispatchEvent(new CustomEvent("anithink:notifications-changed", { detail: remaining.length })); };
  return <div className="mt-6 space-y-3">
    {notifPref !== null && (
      notifPref ? (
        <div className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-accent">
          <Bell className="h-5 w-5 shrink-0" />
          <span>Уведомления о новых сериях включены. Показываем свежие эпизоды онгоингов.</span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 shrink-0 text-muted" />
            <span className="text-muted">Уведомления о новых сериях сейчас выключены.</span>
          </div>
          <Link href="/settings" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-background hover:opacity-90">
            <Settings2 className="h-3.5 w-3.5" />Включить
          </Link>
        </div>
      )
    )}
    <div className="flex justify-end gap-2"><button onClick={() => remove(selected)} disabled={!selected.length} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40">Удалить выбранные</button><button onClick={() => remove(items.map((item) => item.id))} disabled={!items.length} className="inline-flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />Удалить всё</button></div>{items.map((item) => { const Icon = item.kind === "news" ? Newspaper : PlayCircle; const checked = selected.includes(item.id); return <div key={item.id} className={`flex items-center gap-3 rounded-xl border bg-card p-4 ${checked ? "border-accent shadow-neon-sm" : "border-border"}`}><input type="checkbox" checked={checked} onChange={() => setSelected((current) => checked ? current.filter((id) => id !== item.id) : [...current, item.id])} className="h-5 w-5 cursor-pointer appearance-none rounded-full border-2 border-border bg-surface transition-all checked:border-accent checked:bg-accent checked:shadow-neon-sm" /><Link href={item.href} className="flex flex-1 items-center gap-3"><Icon className="h-5 w-5 text-accent" /><span className="text-sm font-semibold">{item.title}</span></Link></div>; })}{!items.length && <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border text-muted"><Bell className="h-8 w-8" /><p className="mt-2 text-sm">Новых уведомлений нет.</p></div>}</div>;
}
