// ═══════════════════════════════════════════════════════════════
// Centralized formatters for the Shippar ERP
// One source of truth — no more 7 copies of formatMoney
// ═══════════════════════════════════════════════════════════════

/** USD format: 1,234.56 (for cotizaciones, commissions) */
export const formatUSD = (n: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** ARS format without decimals: $1.234 (for cobranzas, finanzas quick view) */
export const formatARS = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

/** ARS format with 2 decimals: $1.234,56 (for detailed financial views) */
export const formatARSFull = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n);

/** Weight format: 12.5 (1 decimal) */
export const formatKg = (n: number) => n.toFixed(1);

/** Short date in AR locale: 13/03/26 */
export const formatDateAR = (date: string | Date) =>
    new Date(date).toLocaleDateString('es-AR');
