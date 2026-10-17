import { protectWebProvider } from "../security/web-provider";
import { getSecurityController } from "../security/runtime";
import "server-only";
import { createSerpApiProvider } from "./serpapi";
import { createWebSearchService } from "./search-service";
import { authorizedSources } from "./authorized-sources";
import { fetchAuthorizedPage } from "./secure-fetch";
import { WebSearchError } from "../../web/errors";
let service: ReturnType<typeof createWebSearchService> | undefined;
export async function searchWebRecipes(query: string, cursor?: string | null) {
  if (!process.env.SERPAPI_API_KEY?.trim() || (process.env.WEB_SEARCH_PROVIDER ?? "serpapi") !== "serpapi") throw new WebSearchError("CONFIGURATION", 503);
  service ??= createWebSearchService(protectWebProvider(createSerpApiProvider(process.env.SERPAPI_API_KEY), getSecurityController), authorizedSources, fetchAuthorizedPage);
  return service(query, cursor);
}
