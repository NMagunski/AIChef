import { getSecurityController } from "@/lib/server/security/runtime";
import "server-only";
import { createWebSearchHandler } from "@/lib/server/web/search-handler";
import { searchWebRecipes } from "@/lib/server/web/search-runtime";
export const runtime = "nodejs";
export const POST = createWebSearchHandler(searchWebRecipes, getSecurityController);
