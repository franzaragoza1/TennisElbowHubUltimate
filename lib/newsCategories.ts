/** Vive fuera de `app/admin/actions.ts` porque un fichero "use server" solo puede
 * exportar funciones asíncronas. */
export const NEWS_CATEGORIES = ["REPORT", "ANNOUNCEMENT", "RESULTS", "FEATURE"] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];
