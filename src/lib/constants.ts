// ═══════════════════════════════════════════════════════════════
// Centralized business constants for the Shippar ERP
// ═══════════════════════════════════════════════════════════════

// ── Cotizaciones: CIF calculation ──
export const CIF_FLETE_PER_KG = 2.70;      // USD per kg for CIF freight
export const CIF_SEGURO_PCT = 0.01;         // Insurance = 1% of FOB

// ── Cotizaciones: Gasto Documental ──
export const GASTO_DOC_LOW_THRESHOLD = 500; // FOB < $500 uses low-rate formula
export const GASTO_DOC_LOW_RATE = 0.20;     // 20% of FOB
export const GASTO_DOC_LOW_CAP = 60;        // max $60
export const GASTO_DOC_HIGH_RATE = 0.0935;  // 9.35% of FOB
export const GASTO_DOC_HIGH_CAP = 140;      // max $140

// ── Cotizaciones: Default tax percentages ──
export const DEFAULT_TASA_ESTADISTICA = 3;
export const DEFAULT_IVA_105 = 10.5;
export const DEFAULT_IVA_21 = 0;
export const DEFAULT_DERECHOS = 0;

// ── Delivery estimates (business days) ──
export const DELIVERY_DAYS_EXPRESS = '5-8';
export const DELIVERY_DAYS_STANDARD = '10-12';

// ── Quote validity ──
export const QUOTE_VALIDITY_HOURS = 72;

// ── Company info (for PDF/branding) ──
export const COMPANY_LEGAL_NAME = 'Shippar Global Logistics S.R.L.';

/**
 * Calculate gasto documental based on FOB value.
 * Centralized here so both cotizaciones and tests use the same formula.
 */
export function calcGastoDocumental(fob: number | null): number {
    if (!fob || fob <= 0) return 0;
    if (fob < GASTO_DOC_LOW_THRESHOLD) return Math.min(fob * GASTO_DOC_LOW_RATE, GASTO_DOC_LOW_CAP);
    return Math.min(fob * GASTO_DOC_HIGH_RATE, GASTO_DOC_HIGH_CAP);
}

// ── Shipment Status Groups ──
// Single source of truth — used by shipments, deposito, operations, gerencia, etc.
export const SHIPMENT_STATUSES = {
    TRANSIT: ['Guía Creada', 'Pendiente Expo', 'En Transito'] as const,
    AT_DEPOT: ['Recibido en Oficina', 'Enviado BUE', 'Cerrado/Facturado', 'Listo Para Entregar'] as const,
    DELIVERED: ['Entregado', 'Retirado', 'Despachado', 'Mercado Libre full'] as const,
    RETENIDO: ['Retenido'] as const,
} as const;

/** All statuses that mean "already received" (depot + delivered) */
export const RECEIVED_STATUSES = [
    ...SHIPMENT_STATUSES.AT_DEPOT,
    ...SHIPMENT_STATUSES.DELIVERED,
] as const;

/** Status options for creating/editing shipments */
export const STATUS_OPTIONS = [...SHIPMENT_STATUSES.TRANSIT] as const;

// ── ERP Color Palette ──
export const ERP_COLORS = {
    transit: '#2E7BFF',
    success: '#10B981',
    warning: '#FFB020',
    danger: '#EF4444',
    depot: '#8B5CF6',
    info: '#00C2FF',
} as const;
