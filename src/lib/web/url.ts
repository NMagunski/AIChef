import ipaddr from "ipaddr.js";
import { generatedRecipeId } from "../ai/recipe-schema.ts";
export function isPublicAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === "unicast"; } catch { return false; }
}
/** Syntactic public-URL validation. Fetchers must ALSO validate and pin DNS results. */
export function publicRecipeUrl(input: string): string {
  if (input.length > 2048) throw new Error("UNSAFE_URL");
  const url = new URL(input);
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port || !host || host === "localhost" || /\.(localhost|local|internal|invalid|test)$/u.test(host) || (!host.includes(".") && !host.includes(":"))) throw new Error("UNSAFE_URL");
  if (ipaddr.isValid(host) && !isPublicAddress(host)) throw new Error("UNSAFE_URL");
  if (/^\d+(?:\.\d+)*$/.test(host) && !ipaddr.isValid(host)) throw new Error("UNSAFE_URL");
  for (const name of url.searchParams.keys()) if (/^(api_?key|key|token|access_token|authorization)$/i.test(name)) throw new Error("UNSAFE_URL");
  url.hash = ""; url.hostname = host.includes(":") ? `[${host}]` : host;
  return url.href;
}
export function canonicalRecipeUrl(input: string): string {
  const url = new URL(publicRecipeUrl(input));
  for (const name of [...url.searchParams.keys()]) if (/^(utm_.+|fbclid|fb_comment_id|gclid|ref|print|output)$/i.test(name)) url.searchParams.delete(name);
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/amp\/?$/i, "/").replace(/\/$/, "") || "/";
  return url.href;
}
export function recipeUrlKey(input: string) {
  const url = new URL(canonicalRecipeUrl(input));
  return `${url.hostname.replace(/^www\./, "")}${url.pathname}${url.search}`;
}
export const webRecipeId = (input: string) => generatedRecipeId(recipeUrlKey(input)).replace(/^ai-/, "web-");
export const webIdPattern = /^web-[a-f0-9]{16}$/;
