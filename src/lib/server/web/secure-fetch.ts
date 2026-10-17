import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { isPublicAddress, publicRecipeUrl } from "../../web/url.ts";
export type Lookup = (hostname: string) => Promise<{ address: string; family: number }[]>;
export async function validatePublicTarget(input: string, lookup: Lookup = (host) => dnsLookup(host, { all: true, verbatim: true })) {
  const url = new URL(publicRecipeUrl(input));
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""));
  if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) throw new Error("UNSAFE_URL");
  return { url, address: addresses[0] };
}
export type PageResponse = { status: number; location?: string; html: string; contentType: string };
export type PageTransport = (url: URL, address: { address: string; family: number }, signal: AbortSignal) => Promise<PageResponse>;
const pinnedTransport: PageTransport = (url, address, signal) => new Promise((resolve, reject) => {
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;
  const req = send(url, {
    method: "GET", agent: false, family: address.family,
    lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
    signal, headers: { "User-Agent": "AIChef/1.0 (authorized recipe retrieval)", Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity" },
  }, (response) => {
    const status = response.statusCode ?? 502;
    if (status >= 300 && status < 400) { response.resume(); resolve({ status, location: response.headers.location, html: "", contentType: "" }); return; }
    const chunks: Buffer[] = []; let size = 0;
    if (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") { response.destroy(); reject(new Error("SOURCE_ENCODING")); return; }
    response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 1_000_000) { response.destroy(); reject(new Error("SOURCE_TOO_LARGE")); } else chunks.push(chunk); });
    response.on("end", () => resolve({ status, html: Buffer.concat(chunks).toString("utf8"), contentType: response.headers["content-type"] ?? "" }));
    response.on("error", reject);
  });
  req.on("error", reject); req.end();
});
/** DNS addresses are checked, then pinned to the socket lookup (no rebinding gap).
 * Every redirect is revalidated AND reauthorized before connecting. */
export async function fetchAuthorizedPage(input: string, authorize: (url: string) => boolean, options: { lookup?: Lookup; transport?: PageTransport; signal?: AbortSignal } = {}) {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(6000)]) : AbortSignal.timeout(6000);
  let current = publicRecipeUrl(input);
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (signal.aborted) throw new Error("SOURCE_TIMEOUT");
    if (!authorize(current)) throw new Error("SOURCE_NOT_AUTHORIZED");
    const { url, address } = await Promise.race([validatePublicTarget(current, options.lookup), new Promise<never>((_, reject) => { signal.addEventListener("abort", () => reject(new Error("SOURCE_TIMEOUT")), { once: true }); })]);
    const response = await (options.transport ?? pinnedTransport)(url, address, signal);
    if (response.status >= 300 && response.status < 400 && response.location) {
      if (redirects === 3) throw new Error("SOURCE_REDIRECT_LIMIT");
      current = publicRecipeUrl(new URL(response.location, url).href); continue;
    }
    if (response.status !== 200 || !/^(text\/html|application\/xhtml\+xml)/i.test(response.contentType)) throw new Error("SOURCE_BLOCKED");
    if (Buffer.byteLength(response.html) > 1_000_000) throw new Error("SOURCE_TOO_LARGE");
    return { html: response.html, url: current };
  }
  throw new Error("SOURCE_REDIRECT_LIMIT");
}
