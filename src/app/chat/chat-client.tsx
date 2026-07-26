"use client";

import {
  AlertTriangle,
  Check,
  Inbox,
  LoaderCircle,
  MessageCirclePlus,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "@/components/providers/toast-provider";
import { supabase } from "@/lib/supabase";

type Contact = { id: string; nickname: string; tag: string; avatar?: string | null };
type Message = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string };

const CONTACTS_KEY = "anithink:chat-contacts";
const FALLBACK_USER_ID = "00000000-0000-0000-0000-000000000000";

const normalizeTag = (value: string) => value.trim().replace(/^@+/, "").replace(/\s+/g, "");

const toContact = (profile: Record<string, unknown>): Contact => ({
  id: String(profile.id),
  nickname: String(profile.nickname || profile.username || profile.tag),
  tag: String(profile.tag),
  avatar: typeof profile.avatar_url === "string" ? profile.avatar_url : null,
});

function readContacts(): Contact[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CONTACTS_KEY) ?? "[]");
    return Array.isArray(value) ? (value as Contact[]) : [];
  } catch {
    return [];
  }
}

function Avatar({ contact, small = false }: { contact: Contact; small?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-gradient font-bold text-background ring-1 ring-accent/70 ${
        small ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm"
      }`}
    >
      {contact.avatar ? (
        <img src={contact.avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        contact.nickname.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

export function ChatClient() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [requests, setRequests] = useState<Contact[]>([]);
  const [activeTab, setActiveTab] = useState<"contacts" | "requests">("contacts");

  const [active, setActive] = useState<Contact | null>(null);
  const [tag, setTag] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [found, setFound] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");

  const [currentUserId, setCurrentUserId] = useState<string>(FALLBACK_USER_ID);
  const [myProfile, setMyProfile] = useState<Contact | null>(null);

  // Для модалки удаления
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Загрузка входящих запросов на переписку
  const loadRequests = async (userId: string, currentContacts: Contact[]) => {
    const client = supabase;
    if (!client || userId === FALLBACK_USER_ID) return;

    const { data: msgSenders } = await client
      .from("messages")
      .select("sender_id")
      .eq("receiver_id", userId);

    if (!msgSenders || !msgSenders.length) return;

    const contactIds = new Set(currentContacts.map((c) => c.id));
    const unknownSenderIds = Array.from(
      new Set(
        msgSenders
          .map((m) => m.sender_id)
          .filter((id) => id !== userId && !contactIds.has(id))
      )
    );

    if (!unknownSenderIds.length) {
      setRequests([]);
      return;
    }

    const { data: profiles } = await client
      .from("profiles")
      .select("*")
      .in("id", unknownSenderIds);

    if (profiles) {
      setRequests(profiles.map(toContact));
    }
  };

  // 1. Инициализация и слушатель авторизации
  useEffect(() => {
    const loadedContacts = readContacts();
    setContacts(loadedContacts);

    const client = supabase;
    if (!client) return;

    const initUser = async () => {
      const { data } = await client.auth.getUser();
      if (data.user) {
        setCurrentUserId(data.user.id);

        // Подтягиваем собственный профиль для аватарки в чате
        const { data: profile } = await client
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile) setMyProfile(toContact(profile));
        void loadRequests(data.user.id, loadedContacts);
      }
    };

    void initUser();

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const newId = session?.user?.id ?? FALLBACK_USER_ID;
      setCurrentUserId(newId);
      if (session?.user) {
        void loadRequests(newId, loadedContacts);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Загрузка переписки и Realtime
  useEffect(() => {
    const client = supabase;
    if (!active || !client) {
      setMessages([]);
      return;
    }

    let mounted = true;

    const load = async () => {
      const { data, error } = await client
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${active.id}),and(sender_id.eq.${active.id},receiver_id.eq.${currentUserId})`)
        .order("created_at", { ascending: true });

      if (!error && mounted) setMessages(data as Message[]);
    };

    void load();

    const channel = client
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const message = payload.new as Message;
          const belongs =
            (message.sender_id === currentUserId && message.receiver_id === active.id) ||
            (message.sender_id === active.id && message.receiver_id === currentUserId);

          if (belongs) {
            setMessages((current) =>
              current.some((item) => item.id === message.id) ? current : [...current, message]
            );
          }

          // Если нам пришло новое сообщение от незнакомца — обновляем запросы
          if (message.receiver_id === currentUserId) {
            void loadRequests(currentUserId, contacts);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void client.removeChannel(channel);
    };
  }, [active, currentUserId, contacts]);

  // Поиск по тегу
  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    const searchedTag = normalizeTag(tag);

    if (!searchedTag) {
      toast("Введите тег пользователя", true);
      return;
    }

    const client = supabase;
    if (!client) {
      toast("Supabase не настроен", true);
      return;
    }

    setIsSearching(true);
    setFound(null);

    const { data, error } = await client
      .from("profiles")
      .select("*")
      .ilike("tag", searchedTag)
      .limit(1);

    setIsSearching(false);

    const profile = Array.isArray(data) ? data[0] : null;

    if (error || !profile) {
      toast(`Пользователь с тегом @${searchedTag} не найден`, true);
      return;
    }

    setFound(toContact(profile as Record<string, unknown>));
  };

  // Добавление в контакты
  const addToContacts = (contact: Contact) => {
    if (contacts.some((c) => c.id === contact.id)) return;

    const next = [contact, ...contacts];
    setContacts(next);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(next));
    setRequests((prev) => prev.filter((r) => r.id !== contact.id));
    toast(`@${contact.tag} добавлен в контакты`);
  };

  // Открыть диалог
  const startDialog = (contact: Contact) => {
    setActive(contact);
    setFound(null);
    setTag("");
  };

  // Полное удаление чата
  const confirmDeleteChat = async () => {
    if (!contactToDelete) return;
    setIsDeleting(true);

    try {
      const client = supabase;
      // Удаляем сообщения из Supabase если авторизованы
      if (client && currentUserId !== FALLBACK_USER_ID) {
        await client
          .from("messages")
          .delete()
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${contactToDelete.id}),and(sender_id.eq.${contactToDelete.id},receiver_id.eq.${currentUserId})`);
      }

      // Удаляем из списка контактов и запросов
      const updatedContacts = contacts.filter((c) => c.id !== contactToDelete.id);
      setContacts(updatedContacts);
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(updatedContacts));
      setRequests((prev) => prev.filter((r) => r.id !== contactToDelete.id));

      if (active?.id === contactToDelete.id) {
        setActive(null);
      }

      toast("Чат успешно удалён");
    } catch (err) {
      console.error(err);
      toast("Ошибка при удалении чата", true);
    } finally {
      setIsDeleting(false);
      setContactToDelete(null);
    }
  };

  // Отправка сообщения
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = text.trim();

    const client = supabase;
    if (!content || !active || !client) return;

    const { error } = await client.from("messages").insert({
      sender_id: currentUserId,
      receiver_id: active.id,
      content,
    });

    if (error) {
      console.error("Ошибка при отправке сообщения в Supabase:", error);
      toast(`Ошибка: ${error.message}`, true);
    } else {
      setText("");
    }
  };

  const isSavedContact = active ? contacts.some((c) => c.id === active.id) : false;

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-cyber">
        <div className="border-b border-border bg-accent/5 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Realtime social</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-bold">
            <Users className="h-6 w-6 text-accent" />
            Друзья и личные сообщения
          </h1>
        </div>

        {/* Фиксированная высота всего блока чата */}
        <div className="grid h-[620px] md:grid-cols-[320px_1fr]">
          {/* Левая панель */}
          <aside className="flex flex-col border-b border-border bg-surface/35 p-4 md:border-b-0 md:border-r overflow-hidden">
            <form onSubmit={handleSearch} className="flex gap-2">
              <label className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
                <input
                  value={tag}
                  onChange={(event) => setTag(event.target.value)}
                  placeholder="@anime_user"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent"
                />
              </label>
              <button
                type="submit"
                disabled={isSearching}
                className="inline-flex min-w-[76px] items-center justify-center gap-1 rounded-xl bg-accent px-3 text-xs font-bold text-background disabled:opacity-60"
              >
                {isSearching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Найти"}
              </button>
            </form>

            {found && (
              <div className="mt-3 rounded-2xl border border-accent/50 bg-accent/10 p-3 shadow-neon-sm shrink-0">
                <div className="flex items-center gap-3">
                  <Avatar contact={found} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{found.nickname}</b>
                    <span className="text-xs text-accent">@{found.tag}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    addToContacts(found);
                    startDialog(found);
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-background"
                >
                  <MessageCirclePlus className="h-4 w-4" />
                  Начать диалог
                </button>
              </div>
            )}

            {/* Табы: Контакты / Запросы */}
            <div className="mt-4 flex rounded-xl border border-border bg-background/50 p-1 shrink-0">
              <button
                onClick={() => setActiveTab("contacts")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                  activeTab === "contacts" ? "bg-accent text-background" : "text-muted hover:text-foreground"
                }`}
              >
                Контакты ({contacts.length})
              </button>
              <button
                onClick={() => setActiveTab("requests")}
                className={`relative flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                  activeTab === "requests" ? "bg-accent text-background" : "text-muted hover:text-foreground"
                }`}
              >
                Запросы
                {requests.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                    {requests.length}
                  </span>
                )}
              </button>
            </div>

            {/* Список диалогов со скроллом */}
            <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-cyber">
              {activeTab === "contacts" ? (
                contacts.length ? (
                  contacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => startDialog(contact)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition ${
                        active?.id === contact.id
                          ? "border-accent bg-accent/10 shadow-neon-sm"
                          : "border-border bg-surface hover:border-accent/50"
                      }`}
                    >
                      <Avatar contact={contact} small />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-sm">{contact.nickname}</b>
                        <span className="block truncate text-xs text-accent">@{contact.tag}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted">
                    <UserPlus className="mx-auto mb-2 h-5 w-5 text-accent" />
                    Контактов пока нет.
                  </div>
                )
              ) : requests.length ? (
                requests.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => startDialog(contact)}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border p-2.5 transition ${
                      active?.id === contact.id
                        ? "border-accent bg-accent/10"
                        : "border-border bg-surface hover:border-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar contact={contact} small />
                      <span className="min-w-0">
                        <b className="block truncate text-xs">{contact.nickname}</b>
                        <span className="block truncate text-[10px] text-accent">@{contact.tag}</span>
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToContacts(contact);
                      }}
                      className="rounded-lg bg-accent/15 p-1.5 text-accent hover:bg-accent hover:text-background"
                      title="Добавить в контакты"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted">
                  <Inbox className="mx-auto mb-2 h-5 w-5 text-accent" />
                  Новых запросов нет.
                </div>
              )}
            </div>
          </aside>

          {/* Правая панель переписки */}
          <div className="flex min-w-0 flex-col h-full bg-background/30 overflow-hidden">
            {active ? (
              <>
                {/* Шапка диалога */}
                <div className="flex items-center justify-between border-b border-border p-4 bg-card shrink-0">
                  <div className="flex items-center gap-3">
                    <Avatar contact={active} />
                    <div>
                      <b className="text-sm font-bold">{active.nickname}</b>
                      <p className="text-xs text-accent">@{active.tag}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isSavedContact && (
                      <button
                        onClick={() => addToContacts(active)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent hover:text-background transition"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        В контакты
                      </button>
                    )}
                    <button
                      onClick={() => setContactToDelete(active)}
                      className="rounded-xl p-2 text-muted hover:bg-red-500/10 hover:text-red-400 transition"
                      title="Удалить чат"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Сообщения со своим скроллбаром */}
                <div className="flex-1 space-y-3.5 overflow-y-auto p-5 scrollbar-cyber">
                  {messages.length ? (
                    messages.map((message) => {
                      const isIncoming = message.sender_id === active.id;
                      const isMyMessage = !isIncoming;

                      return (
                        <div
                          key={message.id || message.created_at}
                          className={`flex items-end gap-2.5 max-w-[80%] ${
                            isMyMessage ? "ml-auto flex-row-reverse" : "mr-auto flex-row"
                          }`}
                        >
                          {/* Аватарка */}
                          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border/60 bg-surface shadow-sm flex items-center justify-center">
                            {isMyMessage ? (
                              myProfile?.avatar ? (
                                <img src={myProfile.avatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-accent text-xs font-bold text-background">
                                  {myProfile?.nickname?.[0]?.toUpperCase() || "Я"}
                                </div>
                              )
                            ) : active.avatar ? (
                              <img src={active.avatar} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-border text-xs font-bold text-muted">
                                {active.nickname?.[0]?.toUpperCase() || "?"}
                              </div>
                            )}
                          </div>

                          {/* Облачко сообщения */}
                          <div
                            className={`relative rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-all ${
                              isMyMessage
                                ? "bg-accent text-background rounded-br-xs font-medium"
                                : "bg-surface/90 border border-border/70 text-foreground rounded-bl-xs"
                            }`}
                          >
                            {isIncoming && (
                              <p className="mb-1 text-[11px] font-bold text-accent">
                                {active.nickname || active.tag}
                              </p>
                            )}

                            <p className="whitespace-pre-wrap break-words">{message.content}</p>

                            <time
                              className={`mt-1 block text-[10px] text-right ${
                                isMyMessage ? "text-background/70" : "text-muted"
                              }`}
                            >
                              {message.created_at
                                ? new Date(message.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "только что"}
                            </time>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <EmptyChat name={active.nickname} />
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Форма ввода */}
                <form onSubmit={send} className="flex gap-2 border-t border-border p-4 bg-card shrink-0">
                  <input
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={`Написать ${active.nickname}…`}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-background transition hover:opacity-90"
                  >
                    <Send className="h-4 w-4" />
                    Отправить
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/10 text-accent shadow-neon-sm">
                  <MessageCirclePlus className="h-8 w-8" />
                </span>
                <h2 className="mt-4 font-display text-xl font-bold">Выберите контакт</h2>
                <p className="mt-2 max-w-sm text-sm text-muted">
                  Найдите пользователя по тегу или выберите из списка слева.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Анимированная модалка подтверждения удаления */}
      {contactToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-cyber animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setContactToDelete(null)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h3 className="text-center font-display text-lg font-bold">Удалить чат?</h3>
            <p className="mt-2 text-center text-xs text-muted leading-relaxed">
              Вы точно хотите навсегда удалить чат с <b className="text-foreground">@{contactToDelete.tag}</b>?
              История сообщений будет полностью очищена.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setContactToDelete(null)}
                className="flex-1 rounded-xl border border-border bg-surface py-2.5 text-xs font-bold text-muted hover:text-foreground transition"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteChat}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? "Удаление..." : "Да, удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EmptyChat({ name }: { name: string }) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
      <MessageCirclePlus className="h-8 w-8 text-accent mb-2" />
      <p className="text-sm text-muted">Начните диалог с {name}.</p>
    </div>
  );
}