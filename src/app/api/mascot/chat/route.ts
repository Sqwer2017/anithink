import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface ChatMessage {
  role: string;
  content: string;
}

const SYSTEM_INSTRUCTION =
  "Ты — Синко (Thinko), жизнерадостная и милая аниме-помощница на сайте AniThink. " +
  "Твоя цель — помогать пользователям выбирать аниме, обсуждать тайтлы и поддерживать разговор. " +
  "Отвечай кратко (2-3 предложения), с лёгким аниме-эмодзи и задором.";

const GEMINI_MODEL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

/** Уютные заглушки, когда ключ не задан или Gemini упала */
const FALLBACKS: string[] = [
  "О! Ты хочешь обсудить аниме? Попробуй глянуть «Милый во Франксе» или «Магическую битву»! ✨",
  "Ах, интересный вопрос! Советую к просмотру что-нибудь лёгкое — «Сосед сверху преподносится спокойно»... эх, сама мечтаю о таких историях 🌸",
  "Хочешь уютный романс или зубодробительный экшен? В AniThink есть всё — скажи, что по душе, подскажу! 🍥",
  "Мне нравится, как ты мыслишь! Давай подберём тебе что-то под настроение — драммы, комедии, киберпанк? У меня тысяча идей 💫",
  "Ахх, я бы посоветовала что-нибудь тёплое и доброе. Как насчёт аниме про дружбу и приключения? 🐾",
  "Твои вопросы так веселят! Загляни в раздел «Топ 10» — там сплошные шедевры, не прогадаешь! 🏆",
  "Попробуй «Врата Штейна» — если любишь закрученные сюжеты, не оторвёшься! 😍",
  "По настроению ищу что-нибудь с вайбом. Дай мне знак — и подберу идеальный тайтл! 🎌",
];

function randomFallback(): string {
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
}

async function callGemini(
  history: ChatMessage[],
  message: string,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY not set");
  }

  // Собираем историю + текущее сообщение
  const contents = history.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));
  contents.push({ role: "user", parts: [{ text: message }] });

  const res = await fetch(`${GEMINI_MODEL}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 8000,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini status: ${res.status}`);
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini вернул пустой ответ");
  }
  return text.trim();
}

export async function POST(request: NextRequest) {
  let body: { message?: string; history?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ reply: randomFallback() });
  }

  const message = body?.message?.trim();
  const history = Array.isArray(body?.history) ? body.history : [];

  if (!message) {
    return NextResponse.json(
      { reply: "Скажи мне что-нибудь, и я всё разберу! 💬" },
      { status: 200 },
    );
  }

  try {
    const reply = await callGemini(history.slice(-8), message);
    return NextResponse.json({ reply });
  } catch (err) {
    // Ключ не задан или ошибка Gemini — логируем точную причину и отдаём заглушку
    console.error("Gemini Error:", err);
    return NextResponse.json({ reply: randomFallback() });
  }
}
