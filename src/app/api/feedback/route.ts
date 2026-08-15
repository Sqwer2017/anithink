import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeedbackType = "bug" | "suggestion" | "question";

interface FeedbackBody {
  type?: FeedbackType;
  message?: string;
  nickname?: string;
  pageUrl?: string;
}

const TYPE_LABEL: Record<FeedbackType, string> = {
  bug: "🐛 Баг",
  suggestion: "💡 Предложение",
  question: "❓ Вопрос",
};

/**
 * 1. Серверный роут обратной связи.
 * Принимает отзыв и отправляет красивое HTML-сообщение в Telegram-бота.
 */
export async function POST(request: NextRequest) {
  let body: FeedbackBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Невалидный JSON" }, { status: 400 });
  }

  const type = body?.type ?? "question";
  const message = body?.message?.trim();
  const nickname = body?.nickname?.trim();
  const pageUrl = body?.pageUrl?.trim();

  if (!message) {
    return NextResponse.json({ success: false, error: "Сообщение пустое" }, { status: 400 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return NextResponse.json(
      { success: false, error: "Telegram не настроен на сервере" },
      { status: 500 },
    );
  }

  // Экранируем от HTML-инъекций в telegram-сообщении
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

  const formatted = [
    "<b>📩 Новое сообщение с AniThink!</b>",
    `<b>Тип:</b> ${TYPE_LABEL[type] ?? type}`,
    `<b>От пользователя:</b> ${esc(nickname || "Не указан")}`,
    pageUrl ? `<b>Страница:</b> ${esc(pageUrl)}` : "",
    "",
    "<b>Сообщение:</b>",
    esc(message),
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: formatted, parse_mode: "HTML" }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[feedback] Telegram error:", res.status, detail.slice(0, 200));
      return NextResponse.json(
        { success: false, error: `Telegram API: ${res.status}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[feedback] send error:", err);
    return NextResponse.json({ success: false, error: "Не удалось отправить" }, { status: 500 });
  }
}
