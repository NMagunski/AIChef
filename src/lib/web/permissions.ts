import { z } from "zod";
import { publicRecipeUrl } from "./url.ts";
export const permissionSchema = z.object({
  contentPermission: z.enum(["authorized", "metadata_only", "unknown"]), attributionRequired: z.boolean(),
  licenseReference: z.string().min(1).max(1000).nullable(), evidenceReference: z.string().min(1).max(1000).nullable(),
  imageReuseAllowed: z.boolean(), reviewedAt: z.string().datetime().nullable(), expiresAt: z.number().finite().nullable(),
}).strict();
export type ContentPermission = z.infer<typeof permissionSchema>;
export const authorizedSourceSchema = z.object({
  origin: z.string().url(), pathPrefix: z.string().startsWith("/"), sourceName: z.string().min(1).max(200),
  licenseReference: z.string().min(1).max(1000), evidenceReference: z.string().min(1).max(1000),
  attributionRequired: z.boolean(), imageReuseAllowed: z.boolean(), reviewedAt: z.string().datetime(), expiresAt: z.number().finite().nullable(),
}).strict();
export type AuthorizedSource = z.infer<typeof authorizedSourceSchema>;
export function classifyPermission(input: string, sources: readonly AuthorizedSource[], now = Date.now()): ContentPermission {
  const url = new URL(publicRecipeUrl(input));
  const found = sources.find((value) => {
    const parsed = authorizedSourceSchema.safeParse(value);
    if (!parsed.success) return false;
    const entry = parsed.data;
    try {
      const origin = new URL(publicRecipeUrl(entry.origin)).origin;
      const prefix = entry.pathPrefix;
      return origin === url.origin && (url.pathname === prefix || url.pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)) && (entry.expiresAt === null || entry.expiresAt > now) && Date.parse(entry.reviewedAt) <= now;
    } catch { return false; }
  });
  return found ? { contentPermission: "authorized", attributionRequired: found.attributionRequired, licenseReference: found.licenseReference, evidenceReference: found.evidenceReference, imageReuseAllowed: found.imageReuseAllowed, reviewedAt: found.reviewedAt, expiresAt: found.expiresAt } : { contentPermission: "unknown", attributionRequired: true, licenseReference: null, evidenceReference: null, imageReuseAllowed: false, reviewedAt: null, expiresAt: null };
}
