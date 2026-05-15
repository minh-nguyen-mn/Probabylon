export function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!value) {
    throw new Error("NEXT_PUBLIC_API_URL is required.");
  }
  return value.replace(/\/+$/, "");
}

export function getWebSocketUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (explicit) return explicit;

  const apiBase = getApiBaseUrl();
  if (apiBase.startsWith("https://")) return apiBase.replace(/^https:\/\//, "wss://").replace(/\/api$/, "/ws/markets");
  if (apiBase.startsWith("http://")) return apiBase.replace(/^http:\/\//, "ws://").replace(/\/api$/, "/ws/markets");
  throw new Error("Unable to derive websocket URL from NEXT_PUBLIC_API_URL.");
}
