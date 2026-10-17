// Клиент серверной функции «agina» (регистрация и проверка ника). Без SERVER.url игра работает локально.
const serverOn = () => !!(SERVER.url && SERVER.anonKey && (SERVER.allowWeb || (typeof tg !== 'undefined' && tg && tg.initData)));

// action: 'me' | 'check' | 'register'. Возвращает {status, ...ответ}; status 0 — нет связи.
async function serverCall(action, body = {}, keepalive = false) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`${SERVER.url}/functions/v1/agina`, {
      method: 'POST', signal: ctl.signal, keepalive,
      headers: { 'Content-Type': 'application/json', apikey: SERVER.anonKey, Authorization: 'Bearer ' + SERVER.anonKey },
      body: JSON.stringify({ action, slot: (typeof syncSlot === 'function' ? syncSlot() : 'main'), initData: (typeof tg !== 'undefined' && tg && tg.initData) || '', ...body }),
    });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, ...j };
  } catch (e) {
    return { status: 0, error: 'network' };
  } finally { clearTimeout(timer); }
}
