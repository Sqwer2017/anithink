# План: Апгрейд Live2D-маскота (анимации, Drag&Drop, ИИ-чат)

## Файлы
1. `src/app/api/mascot/chat/route.ts` — новый POST-роут ИИ-чата
2. `src/components/Mascot.tsx` — переработка (жест, drag, чат-облачко)

---

## 1. Фикс анимаций (блокировка повтора)
- Локальный `isPlayingMotion` флаг в ref.
- `playMotion(group, index, priority)`: если `isPlayingMotion` — игнор. Устанавливает `true`, затем `startMotion(...)`. Сбрасывает в `false` через `setTimeout` на ~длительность моушн (или через колбэк завершения от motionManager). Простая надёжная версия: `setTimeout` фикс-длительность (~1.5с).
- Используется для Tap по клику и для «мысли/разговора» при генерации ИИ-ответа.

## 2. Drag & Drop (ПК + mobile) + сохранение позиции
- Всё на **Pointer Events** (`onPointerDown/Move/Up` + `setPointerCapture`).
- `containerRef` — контейнер маскота (сейчас `fixed bottom-0 right-0`). При drag переключаем на `position: fixed; left: X; top: Y` (в px).
- Разделение Клик/Перетаскивание:
  - `onPointerDown`: запомнить `startX/startY`, `dragging=false`.
  - `onPointerMove`: если удаление от старта >5px → `dragging=true`, двигать контейнер.
  - `onPointerUp`: если `!dragging` (короткий клик) → **проиграть Tap** + **открыть/закрыть чат**. Если `dragging` → сохранение позиции.
- **Сохранение**: `localStorage.setItem("mascot_position", JSON.stringify({x, y}))`. При загрузке — восстановить `left/top` из localStorage, иначе дефолт `bottom-0 right-0`.
- Ограничить позицию, чтобы маскот не улетал за экран (clamp по viewport).

## 3. ИИ-роут `src/app/api/mascot/chat/route.ts`
- `POST` c `{ message, history: [{role, content}] }`.
- `export const runtime = "nodejs"` (для fetch Google API).
- Собирает `contents` из history + message.
- System Instruction: «Ты — Синко (Thinko), жизнерадостная и милая аниме-помощница на сайте AniThink. Твоя цель — помогать пользователям выбирать аниме, обсуждать тайтлы и поддерживать разговор. Отвечай кратко (2-3 предложения), с лёгким аниме-эмодзи и задором.»
- Если `process.env.GEMINI_API_KEY` есть → fetch `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=...` через `POST` c `{ system_instruction, contents }`. Возврат `text` из `candidates[0].content.parts[0].text`.
- Если ключа нет или ошибка → возврат случайного уютного заглушечного ответа (массив из ~8 вариантов типа «О! Ты хочешь обсудить аниме? Попробуй глянуть "Милый во Франксе" или "Магическую битву"! ✨»).
- Ошибки: try/catch → 500 `{ error }`.

## 4. UI Chat-облачка над маскотом
- Внутри `containerRef` (над canvas), **`pointer-events-auto`** (важно: родитель `pointer-events-none`).
- Позиционирование: `absolute bottom-full mb-2 right-4 w-72` — над головой персонажа.
- Анимированное появление: framer-motion уже в проекте — `AnimatePresence` + `motion` (opacity/scale). Внутри Mascot это клиентский компонент, motion доступен.
- Содержимое:
  - Заголовок «Синко 💬» + кнопка-крестик (закрыть).
  - Скроллящаяся история (2-3 последних сообщения) — сообщения `{role, content}`.
  - Поле ввода + кнопка отправки (Send из lucide).
- **Липский стиль**: игривый `bg-card border-border shadow-cyber`, свои сообщения `bg-accent text-background`, ответы `bg-surface/90 border-border`. Лёгкие аниме-эмодзи.
- **Голосовая активность при генерации**: пока ждём ответ — `startMotion("Idle", random, FORCE)` (мысли/речь) либо маленькая пульсация индикатора «Синко думает…».
- Отправка: POST на `/api/mascot/chat`, добавить ответ в стейт history. Хранить историю в компоненте (useState) + snapshot в localStorage (`mascot_chat`), чтобы не терять при релоаде.

## Поведение pointer-events
- Родитель контейнера остаётся `pointer-events-none`, canvas — `[&_canvas]:pointer-events-auto`, чат-облачко — `pointer-events-auto`. Именно canvas получает pointer handlers (drag/click маскота).
- Слушатели drag/click цепляем на `view` (canvas), чат-облачко — отдельный div внутри, не перекрывает canvas и сам прозрачен для событий при `pointer-events-none` на облачке, кроме элементов ввода.

## Проверка
- `npm run build`.
- Ручное: клик по маскоту → Tap + чат открывается; подержать и потянуть → маскот двигается, позиция сохраняется; перезагрузка → позиция восстановлена; отправить в чат → ответ (заглушка если нет ключа).