// Vercel Serverless Function — приём заявки с формы и отправка в Telegram.
// Секреты берутся из переменных окружения проекта Vercel:
//   TELEGRAM_BOT_TOKEN — токен бота от @BotFather
//   TELEGRAM_CHAT_ID   — id чата/группы (для группы обычно отрицательный, напр. -1001234567890)

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function clip(s, n) {
  s = String(s == null ? '' : s).trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  // Vercel парсит JSON-тело автоматически, но подстрахуемся на случай строки.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  // Антиспам: скрытое поле-ловушка (если однажды добавим в форму) — боты его заполняют.
  if (body.website) {
    return res.status(200).json({ ok: true });
  }

  const name = clip(body.name, 200);
  const phone = clip(body.phone, 60);
  const email = clip(body.email, 200);
  const company = clip(body.company, 200);
  const revenue = clip(body.revenue, 80);

  if (!name || !phone || !email || !company) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('apply: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не заданы в окружении');
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }

  const text =
    '<b>Новая заявка — АПС</b>\n\n' +
    '<b>Имя:</b> ' + esc(name) + '\n' +
    '<b>Телефон:</b> ' + esc(phone) + '\n' +
    '<b>Email:</b> ' + esc(email) + '\n' +
    '<b>Компания:</b> ' + esc(company) + '\n' +
    '<b>Оборот:</b> ' + esc(revenue || '—');

  try {
    const tgRes = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    if (!tgRes.ok) {
      const detail = await tgRes.text().catch(() => '');
      console.error('apply: Telegram API вернул', tgRes.status, detail);
      return res.status(502).json({ ok: false, error: 'telegram_failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('apply: ошибка запроса к Telegram', err);
    return res.status(502).json({ ok: false, error: 'telegram_unreachable' });
  }
};
