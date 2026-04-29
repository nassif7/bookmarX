export function sendMessage<T = Record<string, unknown>>(message: { action: string; data?: unknown }): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (r) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve((r ?? {}) as T);
    });
  });
}
