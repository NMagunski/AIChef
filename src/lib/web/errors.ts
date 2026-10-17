import { protectionMessages } from "../api-protection-errors.ts";
export const webErrorMessages: Record<string, string> = {
  ...protectionMessages,
  CONFIGURATION: "Интернет търсенето още не е настроено. AI рецептата е достъпна независимо.",
  AUTHENTICATION: "Достъпът до интернет доставчика е временно недостъпен.",
  QUOTA: "Лимитът за интернет търсене е изчерпан. Опитай по-късно.",
  RATE_LIMIT: "Твърде много интернет търсения. Изчакай малко.",
  TIMEOUT: "Интернет търсенето отне твърде дълго. Опитай отново.",
  INVALID_RESPONSE: "Интернет доставчикът върна невалидни резултати.",
  INVALID_REQUEST: "Въведи търсене до 500 знака и валидна страница.",
  UNAVAILABLE: "Интернет търсенето временно не е достъпно.",
};
export class WebSearchError extends Error {
  code: string; status: number; retryable: boolean; retryAfter: number;
  constructor(code: string, status: number, retryable = false, retryAfter = 0) { super(code); this.code = code; this.status = status; this.retryable = retryable; this.retryAfter = retryAfter; }
}
