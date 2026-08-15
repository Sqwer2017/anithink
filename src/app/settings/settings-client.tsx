"use client";
import { Download, Palette, RotateCcw, SlidersHorizontal, Upload, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/providers/toast-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { readSettings, saveSettings, type LocalSettings } from "@/lib/local-settings";
import { supabase } from "@/lib/supabase";

export function SettingsClient() {
  const [settings, setSettings] = useState<LocalSettings | null>(null); const backupInput = useRef<HTMLInputElement>(null); const { setCustomAccent } = useTheme();
  useEffect(() => { const sync = () => setSettings(readSettings()); sync(); return () => undefined; }, []);

  // При входе подтягиваем приватные настройки из Supabase и сохраняем их.
  // ВАЖНО: все хуки должны идти ДО `if (!settings) return null`, иначе на
  // перерендере число хуков меняется -> "Rendered more hooks than during".
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user || cancelled) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("hide_stats, private_lists, new_episode_notif")
        .eq("id", user.id)
        .maybeSingle();
      if (prof && !cancelled) {
        const next: Partial<LocalSettings> = {
          hideWatchTime: Boolean(prof.hide_stats),
          privateLists: Boolean(prof.private_lists),
          releaseNotifications: Boolean(prof.new_episode_notif),
        };
        setSettings((prev) => (prev ? { ...prev, ...next } : prev));
        saveSettings({ ...(readSettings()), ...next });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!settings) return null;
  const update = (patch: Partial<LocalSettings>, message = "Настройка сохранена") => { const next = { ...settings, ...patch }; setSettings(next); saveSettings(next); document.documentElement.classList.toggle("performance-mode", !next.effects); document.documentElement.classList.toggle("compact-grid", next.compactGrid); toast(message); };

  // Пишет приватные настройки и в localStorage, и в Supabase (если залогинен).
  const persistPrivacy = async (patch: Partial<LocalSettings>) => {
    update(patch);
    if (!supabase) return;
    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;
      const nextSettings = { ...readSettings(), ...patch };
      const row: { [key: string]: unknown } = {
        hide_stats: nextSettings.hideWatchTime,
        private_lists: nextSettings.privateLists,
        new_episode_notif: nextSettings.releaseNotifications,
      };
      // «Приватный список …» — только для друзей: пишем и в *_privacy.
      const privacy = nextSettings.privateLists ? "friends" : "public";
      row.favorites_privacy = privacy;
      row.completed_privacy = privacy;
      row.history_privacy = privacy;
      const { error } = await supabase.from("profiles").upsert(
        { id: user.id, ...row },
        { onConflict: "id" },
      );
      if (error && error.code !== "23505") {
        console.warn("[settings] save to supabase error:", error.message);
      }
    } catch (err) {
      console.warn("[settings] save to supabase failed:", err);
    }
  };

  const exportData = () => { const data: Record<string, string> = {}; Object.keys(localStorage).filter((key) => key.startsWith("anithink:") || key === "animex-accent").forEach((key) => { data[key] = localStorage.getItem(key) || ""; }); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "anithink-backup.json"; link.click(); URL.revokeObjectURL(url); toast("Резервная копия скачана"); };
  return <div><div className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Control deck</p><h1 className="font-display text-3xl font-extrabold">Настройки</h1></div><div className="grid gap-5 lg:grid-cols-2"><Panel title="Интерфейс и визуал"><CyberSwitch label="Эффекты и неоновое свечение" checked={settings.effects} onChange={(effects) => update({ effects }, effects ? "Эффекты включены" : "Режим производительности включён")} /><CyberSwitch label="Компактная сетка карточек" checked={settings.compactGrid} onChange={(compactGrid) => update({ compactGrid })} /><div className="mt-4 border-t border-border pt-4"><p className="text-sm font-semibold">Свой цвет темы</p><div className="mt-3 flex items-center gap-3"><span className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-border shadow-neon-sm" style={{ background: settings.customColor }}><input type="color" value={settings.customColor} onChange={(event) => { const color = event.target.value; update({ customColor: color }, "Цвет обновлён"); setCustomAccent(color); }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></span><button type="button" onClick={() => { setCustomAccent(settings.customColor); toast("Свой цвет применён"); }} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-background"><Palette className="h-4 w-4" />Применить</button></div></div></Panel><Panel title="Приватность и уведомления"><CyberSwitch label="Скрыть статистику часов" checked={settings.hideWatchTime} onChange={(hideWatchTime) => void persistPrivacy({ hideWatchTime })} /><CyberSwitch label="Приватный список просмотренного и любимого" checked={settings.privateLists} onChange={(privateLists) => void persistPrivacy({ privateLists })} /><CyberSwitch label="Уведомлять о новых сериях" checked={settings.releaseNotifications} onChange={(releaseNotifications) => void persistPrivacy({ releaseNotifications })} /></Panel><Panel title="Синко (маскот)"><p className="-mt-2 text-xs text-muted">Интерактивная аниме-помощница в углу экрана.</p><CyberSwitch label="Показывать Синко" checked={settings.mascotEnabled} onChange={(mascotEnabled) => update({ mascotEnabled }, mascotEnabled ? "Синко включена" : "Синко скрыта")} /><div className="mt-3 border-t border-border pt-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Выбор скина</p><div className="grid grid-cols-3 gap-2">{[{ id: "pink", label: "Розовый" }, { id: "cyber", label: "Кибер" }, { id: "pikmi", label: "Пикми" }].map((opt) => { const active = settings.mascotSkin === opt.id; return <button key={opt.id} type="button" onClick={() => update({ mascotSkin: opt.id as "pink" | "cyber" | "pikmi" }, `Скин «${opt.label}» выбран`)} className={`group relative flex flex-col items-center gap-1.5 rounded-2xl border p-2 text-center transition ${active ? "border-accent bg-accent/10 shadow-neon-sm" : "border-border bg-surface hover:border-accent/40"}`}><span className="relative h-16 w-16 overflow-hidden rounded-xl border border-border bg-surface-2"><img src={`/mascot/previews/skin_${opt.id}.png`} alt={opt.label} className="h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: `rgb(var(--accent))` }} /></span><span className={`text-[11px] font-bold ${active ? "text-accent" : "text-muted"}`}>{opt.label}</span></button>; })}</div></div></Panel><Panel title="Управление данными"><Action icon={Download} onClick={exportData}>Скачать бэкап JSON</Action><Action icon={Upload} onClick={() => backupInput.current?.click()}>Восстановить из файла</Action><input ref={backupInput} type="file" accept="application/json" className="hidden" onChange={() => toast("Выберите файл резервной копии")} /><Action icon={RotateCcw} onClick={() => { localStorage.removeItem("anithink:history"); toast("История очищена"); }}>Очистить историю</Action><button type="button" onClick={() => { if (confirm("Полностью удалить данные AniThink?")) { Object.keys(localStorage).filter((key) => key.startsWith("anithink:") || key === "animex-accent").forEach((key) => localStorage.removeItem(key)); location.reload(); } }} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-4 py-2.5 text-sm font-bold text-red-300"><Zap className="h-4 w-4" />Полный сброс</button></Panel><Panel title="Интеграции"><p className="text-sm leading-6 text-muted">Импорт Shikimori требует безопасного OAuth-соединения. Чат и личные сообщения уже готовы к Supabase Realtime.</p></Panel></div></div>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-border bg-card p-5 shadow-panel"><div className="mb-4 flex items-center gap-2 font-display text-xl font-bold"><SlidersHorizontal className="h-5 w-5 text-accent" />{title}</div><div className="space-y-3">{children}</div></section>; }
function CyberSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm font-semibold transition hover:border-accent/60"><span>{label}</span><span className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-300 ${checked ? "border-accent bg-accent/20" : "border-border bg-background"}`}><span className={`absolute left-1 top-1 h-5 w-5 rounded-full transition-all duration-300 ease-out ${checked ? "translate-x-5 bg-accent shadow-neon-sm animate-pulse-glow" : "translate-x-0 bg-muted"}`} /></span></button>; }
function Action({ icon: Icon, onClick, children }: { icon: typeof Download; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className="Action"><Icon className="h-4 w-4" />{children}</button>; }
