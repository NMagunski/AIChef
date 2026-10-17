import { protectionMessages } from "../api-protection-errors.ts";
import { GenerationError } from "./recipe-schema.ts";
export const errorMessages: Record<string, string> = {
  ...protectionMessages,
  GENERATION_LIMIT: "Достигнат е лимитът за допълнителни AI варианти за това търсене.",
  INVALID_REQUEST: "Напиши заявка от 1 до 500 знака.", MALFORMED_JSON: "Заявката не е валиден JSON.", TOO_LARGE: "Заявката е прекалено голяма.",
  CONFIGURATION: "AI рецептите още не са настроени. Липсва сървърна OpenAI конфигурация.", RATE_LIMIT: "Достигнат е лимитът за заявки. Изчакай минута и опитай отново.",
  INSUFFICIENT_QUOTA: "AI рецептите временно не са достъпни поради изчерпан API кредит или проблем с плащането. Администраторът трябва да провери API баланса и настройките за плащане.",
  AUTHENTICATION_ERROR: "AI услугата не е достъпна поради проблем със сървърната конфигурация за достъп. Администраторът трябва да провери настройките.",
  SERVICE_UNAVAILABLE: "AI услугата временно не е достъпна. Опитай отново по-късно.",
  TIMEOUT: "Генерирането отне твърде дълго. Опитай отново.", UNAVAILABLE: "AI услугата временно не е достъпна. Опитай отново по-късно.",
  INVALID_OUTPUT: "Получената рецепта не премина проверките. Опитай отново.", REFUSED: "Не можем да създадем рецепта за тази заявка. Опитай с друго описание.",
  CONSTRAINTS: "Не можем да потвърдим рецепта, която спазва всички условия. Уточни продуктите, ограниченията, времето или порциите.", NETWORK: "Няма връзка със сървъра. Провери връзката и опитай отново.", STORAGE: "Браузърът не позволява временно запазване на рецептата. Разреши съхранението и опитай отново.",
};
export function mapGenerationError(error: unknown): GenerationError {
  if (error instanceof GenerationError) return error;
  const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
  const value = record(error);
  const nested = record(value.error);
  const inner = record(nested.error);
  const identifiers = [value.code, value.type, nested.code, nested.type, inner.code, inner.type];
  if (identifiers.some((code) => code === "credit_balance_exhausted" || code === "insufficient_quota")) return new GenerationError("INSUFFICIENT_QUOTA", 503, false);
  if (value.status === 401 || value.status === 403 || identifiers.includes("invalid_api_key") || identifiers.includes("authentication_error")) return new GenerationError("AUTHENTICATION_ERROR", 503, false);
  if (["ZodError", "SyntaxError"].includes(String(value.name ?? ""))) return new GenerationError("INVALID_OUTPUT", 502, true);
  if (value.status === 429) return new GenerationError("RATE_LIMIT", 429, true);
  if (["APIConnectionTimeoutError", "AbortError", "TimeoutError"].includes(String(value.name ?? ""))) return new GenerationError("TIMEOUT", 504, true);
  return new GenerationError("SERVICE_UNAVAILABLE", 503, true);
}
