export type TelegramSendDeps = {
  fetchFn?: typeof fetch;
  botToken?: string | null;
  chatId?: string | null;
};

export type TelegramSendResult =
  | { ok: true; skipped: true; reason: "not_configured" }
  | { ok: true; skipped: false }
  | { ok: false; skipped: false; error: string };

/**
 * Send a Telegram message via Bot API using fetch.
 * Reads token/chat from args (caller passes env). Never logs secret values.
 * Failures return `{ ok: false }` — they must not crash the collector.
 */
export async function sendTelegramAlert(
  text: string,
  deps: TelegramSendDeps = {},
): Promise<TelegramSendResult> {
  const botToken = deps.botToken ?? null;
  const chatId = deps.chatId ?? null;

  if (!botToken || !chatId) {
    return { ok: true, skipped: true, reason: "not_configured" };
  }

  const fetchFn = deps.fetchFn ?? fetch;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {
        ok: false,
        skipped: false,
        error: `telegram HTTP ${response.status}`,
      };
    }

    return { ok: true, skipped: false };
  } catch {
    return {
      ok: false,
      skipped: false,
      error: "telegram request failed",
    };
  }
}
