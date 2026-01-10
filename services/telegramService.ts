
export interface TelegramResponse {
  ok: boolean;
  description?: string;
}

export async function sendTelegramAlert(
  token: string,
  chatId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  if (!token || !chatId) return { success: false, error: "Missing Token or Chat ID" };

  // Sanitize chatId: ensure it doesn't contain the label "TELEGRAM_CHAT_ID_1=" 
  // in case the user pasted the whole line.
  const cleanChatId = chatId.includes('=') ? chatId.split('=')[1].trim() : chatId.trim();

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true, // This removes the TradingView 'ads' (link previews)
      }),
    });

    const data: TelegramResponse = await response.json();
    
    if (!data.ok) {
      return { success: false, error: data.description || "Unknown Telegram error" };
    }

    return { success: true };
  } catch (error) {
    console.error("Telegram Send Error:", error);
    return { success: false, error: "Network error or invalid Bot Token format" };
  }
}
