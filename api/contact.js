const limits = {
  name: 60,
  email: 120,
  phone: 25,
  message: 1500
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function normalize(value, maxLength) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

function isPhone(value) {
  return value === "" || /^[0-9+() -]{7,25}$/.test(value);
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ error: "Используйте POST-запрос." }, 405);
    }

    const requestOrigin = request.headers.get("origin");
    const currentOrigin = new URL(request.url).origin;
    if (requestOrigin && requestOrigin !== currentOrigin) {
      return json({ error: "Запрос с другого сайта запрещён." }, 403);
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return json({ error: "Ожидается JSON." }, 415);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Некорректные данные формы." }, 400);
    }

    // Скрытое поле заполняют простые спам-боты. Для них возвращаем успех,
    // но сообщение в Telegram не отправляем.
    if (normalize(body.website, 200)) {
      return json({ message: "Сообщение успешно отправлено." });
    }

    const name = normalize(body.name, limits.name);
    const email = normalize(body.email, limits.email).toLowerCase();
    const phone = normalize(body.phone, limits.phone);
    const message = normalize(body.message, limits.message);
    const consent = body.consent === true;

    if (name.length < 2) {
      return json({ error: "Имя должно содержать минимум 2 символа." }, 400);
    }
    if (!isEmail(email)) {
      return json({ error: "Укажите корректный адрес электронной почты." }, 400);
    }
    if (!isPhone(phone)) {
      return json({ error: "Проверьте формат телефона." }, 400);
    }
    if (message.length < 10) {
      return json({ error: "Сообщение должно содержать минимум 10 символов." }, 400);
    }
    if (!consent) {
      return json({ error: "Необходимо подтвердить согласие на обработку данных." }, 400);
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) {
      console.error("Telegram environment variables are missing");
      return json({ error: "Сервис отправки пока не настроен." }, 500);
    }

    const sentAt = new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Europe/Moscow"
    }).format(new Date());

    const telegramText = [
      "📩 Новое обращение с сайта",
      "",
      `Имя: ${name}`,
      `Email: ${email}`,
      `Телефон: ${phone || "не указан"}`,
      "",
      "Сообщение:",
      message,
      "",
      `Время: ${sentAt}`
    ].join("\n");

    try {
      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: telegramText
          })
        }
      );

      const telegramResult = await telegramResponse.json().catch(() => null);
      if (!telegramResponse.ok || !telegramResult?.ok) {
        console.error("Telegram API rejected the message", telegramResult?.description);
        return json({ error: "Telegram не принял сообщение. Проверьте настройки бота." }, 502);
      }
    } catch (error) {
      console.error("Telegram request failed", error instanceof Error ? error.message : error);
      return json({ error: "Не удалось связаться с сервисом отправки." }, 502);
    }

    return json({ message: "Спасибо! Сообщение отправлено администратору." });
  }
};
