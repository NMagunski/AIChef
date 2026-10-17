import "server-only";
import type { AuthorizedSource } from "../../web/permissions";
/** Intentionally empty. Add sources only after documented text/image permission
 * review. Google discovery, JSON-LD and a publisher's popularity are NOT consent. */
export const authorizedSources: readonly AuthorizedSource[] = [];
