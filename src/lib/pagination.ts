/**
 * Pagination constants and helpers.
 *
 * Supabase returns a max of 1000 rows by default.
 * If a query hits this limit, results are silently truncated —
 * the user doesn't know they're missing data.
 *
 * These helpers make pagination explicit and safe.
 */

/** Default page size for most queries */
export const DEFAULT_PAGE_SIZE = 200;

/** Max rows Supabase will return per query (configurable in project settings) */
export const SUPABASE_MAX_ROWS = 1000;

/**
 * Warn if data might be truncated.
 * Call this after any .select() that doesn't have pagination.
 *
 * @returns true if the result count matches the limit (likely truncated)
 */
export function isPossiblyTruncated(dataLength: number, limit: number = SUPABASE_MAX_ROWS): boolean {
    return dataLength >= limit;
}

/**
 * Build Supabase range params for a given page.
 *
 * Usage:
 *   const { from, to } = getPageRange(page, 200);
 *   query.range(from, to);
 */
export function getPageRange(page: number, pageSize: number = DEFAULT_PAGE_SIZE): { from: number; to: number } {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    return { from, to };
}

/**
 * Calculate total pages from a count.
 */
export function getTotalPages(totalCount: number, pageSize: number = DEFAULT_PAGE_SIZE): number {
    return Math.max(1, Math.ceil(totalCount / pageSize));
}
