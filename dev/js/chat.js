// Чат мира: общие (клиент и сервер) правила и проверка сообщений. Хранение и лимиты — на сервере (supabase/schema-chat.sql, функция agina).
// Правила: до CHAT.MAX_LEN знаков, одно сообщение в CHAT.GAP_S секунд, хранится CHAT.KEEP последних сообщений не старше CHAT.KEEP_DAYS суток.
// Запретное слово — сообщение не публикуется и игрок блокируется в чате: 1 час, потом сутки, потом навсегда (снимает админ).
const CHAT = { MAX_LEN: 200, GAP_S: 30, KEEP: 100, KEEP_DAYS: 2, POLL_MS: 5000, BAN_MIN: [60, 1440] };   // BAN_MIN — минуты 1-го и 2-го нарушения, дальше навсегда

// Приводим сообщение к одной строке: без управляющих и невидимых знаков, лишние пробелы схлопнуты
const chatNormalize = (raw) => String(raw == null ? '' : raw).replace(/[\u0000-\u001F\u007F​-‏‪-‮⁠﻿]/g, ' ').replace(/\s+/g, ' ').trim();

// Ссылки, адреса сайтов и @упоминания запрещены (без блокировки: просто отказ)
const CHAT_LINK = /(https?:\/\/|www\.|t\.me\/|@[a-z0-9_]{3,}|\b[a-zа-я0-9-]+\.(ru|com|net|org|me|io|ly|gg|xyz|info|biz|tk|cc|su|рф|ua|by|kz|tv|to|app|dev|online|site|shop|club|top|link)\b)/i;

// Мат и запретные слова: проверяем каждое слово отдельно (иначе «команда» и «спорно» цеплялись бы за соседние слова),
// а одиночные буквы подряд («х у й») склеиваем в одно слово.
function chatHasBad(text) {
  const toks = String(text).split(/[^A-Za-zА-Яа-яЁё0-9@$]+/).filter(Boolean), parts = [];
  let run = '';
  toks.forEach((t) => { if (t.length === 1) run += t; else { if (run) { parts.push(run); run = ''; } parts.push(t); } });
  if (run) parts.push(run);
  String(text).split(/\s+/).forEach((c) => { const w = c.replace(/[^A-Za-zА-Яа-яЁё0-9@$]/g, ''); if (w) parts.push(w); });   // «бл*дь», «х.у.й»: слово целиком без знаков
  return parts.some((w) => nickHasBad(w));
}

// → {ok, text} или {ok:false, error: 'empty' | 'long' | 'link' | 'bad'}
function chatCheck(raw) {
  const text = chatNormalize(raw);
  if (!text) return { ok: false, error: 'empty' };
  if ([...text].length > CHAT.MAX_LEN) return { ok: false, error: 'long' };
  if (CHAT_LINK.test(text)) return { ok: false, error: 'link' };
  if (chatHasBad(text)) return { ok: false, error: 'bad' };
  return { ok: true, text };
}
