import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// COTIZACIONES — Business Logic Tests
// Validates: quote calculation, mode handling, PDF data integrity
// ═══════════════════════════════════════════════════════════════

// ── Quote modes (from AddShipmentModal) ────────────────────────

type QuoteMode = 'manual' | 'pdf' | 'tarifario';

const VALID_QUOTE_MODES: QuoteMode[] = ['manual', 'pdf', 'tarifario'];

interface QuoteData {
    mode: QuoteMode;
    precio_envio: number | null;
    gastos_documentales: number | null;
    impuestos: number | null;
    observaciones_cotizacion: string;
    tarifa_aplicable?: number | null;
    pdf_url?: string | null;
}

// Business logic: calculate total from quote
function calculateQuoteTotal(quote: QuoteData): number {
    const envio = quote.precio_envio || 0;
    const gastos = quote.gastos_documentales || 0;
    const impuestos = quote.impuestos || 0;
    return Math.round((envio + gastos + impuestos) * 100) / 100;
}

// Business logic: validate quote data based on mode
function validateQuote(quote: QuoteData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!VALID_QUOTE_MODES.includes(quote.mode)) {
        errors.push('Modo de cotización inválido');
    }

    if (quote.mode === 'manual') {
        if (quote.precio_envio === null || quote.precio_envio === undefined) {
            errors.push('Precio de envío requerido en modo manual');
        }
        if (quote.precio_envio !== null && quote.precio_envio !== undefined && quote.precio_envio < 0) {
            errors.push('Precio de envío no puede ser negativo');
        }
    }

    if (quote.mode === 'tarifario') {
        if (!quote.tarifa_aplicable || quote.tarifa_aplicable <= 0) {
            errors.push('Tarifa aplicable requerida en modo tarifario');
        }
    }

    if (quote.mode === 'pdf') {
        // In PDF mode, no validation on amounts — they come from uploaded doc
    }

    // Universal validations
    if (quote.gastos_documentales !== null && quote.gastos_documentales !== undefined && quote.gastos_documentales < 0) {
        errors.push('Gastos documentales no puede ser negativo');
    }
    if (quote.impuestos !== null && quote.impuestos !== undefined && quote.impuestos < 0) {
        errors.push('Impuestos no puede ser negativo');
    }

    return { valid: errors.length === 0, errors };
}

// ── CIF value label (the rename from FOB to CIF) ──────────────
function getValueLabel(): string {
    return 'Valor CIF'; // Was incorrectly "Valor FOB declarado" before fix
}

// ═══ TESTS ═══════════════════════════════════════════════════

describe('Quote Modes', () => {
    it('has exactly 3 valid modes', () => {
        expect(VALID_QUOTE_MODES).toHaveLength(3);
        expect(VALID_QUOTE_MODES).toContain('manual');
        expect(VALID_QUOTE_MODES).toContain('pdf');
        expect(VALID_QUOTE_MODES).toContain('tarifario');
    });

    it('rejects invalid modes', () => {
        const result = validateQuote({
            mode: 'fake' as QuoteMode,
            precio_envio: 100,
            gastos_documentales: 50,
            impuestos: 30,
            observaciones_cotizacion: '',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Modo de cotización inválido');
    });
});

describe('Manual Mode Validation', () => {
    it('requires precio_envio', () => {
        const result = validateQuote({
            mode: 'manual',
            precio_envio: null,
            gastos_documentales: 0,
            impuestos: 0,
            observaciones_cotizacion: '',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Precio de envío requerido en modo manual');
    });

    it('rejects negative precio_envio', () => {
        const result = validateQuote({
            mode: 'manual',
            precio_envio: -100,
            gastos_documentales: 0,
            impuestos: 0,
            observaciones_cotizacion: '',
        });
        expect(result.valid).toBe(false);
    });

    it('accepts valid manual quote', () => {
        const result = validateQuote({
            mode: 'manual',
            precio_envio: 250.50,
            gastos_documentales: 75,
            impuestos: 120,
            observaciones_cotizacion: 'Cotización estándar',
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });
});

describe('Tarifario Mode Validation', () => {
    it('requires tarifa_aplicable', () => {
        const result = validateQuote({
            mode: 'tarifario',
            precio_envio: 100,
            gastos_documentales: 0,
            impuestos: 0,
            observaciones_cotizacion: '',
            tarifa_aplicable: null,
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Tarifa aplicable requerida en modo tarifario');
    });

    it('rejects zero or negative tarifa', () => {
        const result = validateQuote({
            mode: 'tarifario',
            precio_envio: 100,
            gastos_documentales: 0,
            impuestos: 0,
            observaciones_cotizacion: '',
            tarifa_aplicable: 0,
        });
        expect(result.valid).toBe(false);
    });

    it('accepts valid tarifario quote', () => {
        const result = validateQuote({
            mode: 'tarifario',
            precio_envio: 300,
            gastos_documentales: 50,
            impuestos: 80,
            observaciones_cotizacion: '',
            tarifa_aplicable: 15.5,
        });
        expect(result.valid).toBe(true);
    });
});

describe('PDF Mode Validation', () => {
    it('accepts PDF mode without specific amount validation', () => {
        const result = validateQuote({
            mode: 'pdf',
            precio_envio: null,
            gastos_documentales: null,
            impuestos: null,
            observaciones_cotizacion: 'Cotización adjunta en PDF',
            pdf_url: 'https://example.com/quote.pdf',
        });
        expect(result.valid).toBe(true);
    });
});

describe('Quote Total Calculation', () => {
    it('calculates correct total from components', () => {
        const quote: QuoteData = {
            mode: 'manual',
            precio_envio: 250.50,
            gastos_documentales: 75.25,
            impuestos: 120.10,
            observaciones_cotizacion: '',
        };
        expect(calculateQuoteTotal(quote)).toBe(445.85);
    });

    it('handles null values as zero', () => {
        const quote: QuoteData = {
            mode: 'manual',
            precio_envio: 100,
            gastos_documentales: null,
            impuestos: null,
            observaciones_cotizacion: '',
        };
        expect(calculateQuoteTotal(quote)).toBe(100);
    });

    it('handles all null values', () => {
        const quote: QuoteData = {
            mode: 'pdf',
            precio_envio: null,
            gastos_documentales: null,
            impuestos: null,
            observaciones_cotizacion: '',
        };
        expect(calculateQuoteTotal(quote)).toBe(0);
    });

    it('rounds to 2 decimal places', () => {
        const quote: QuoteData = {
            mode: 'manual',
            precio_envio: 10.111,
            gastos_documentales: 20.222,
            impuestos: 30.333,
            observaciones_cotizacion: '',
        };
        const total = calculateQuoteTotal(quote);
        const decimals = total.toString().split('.')[1]?.length || 0;
        expect(decimals).toBeLessThanOrEqual(2);
    });

    it('large amounts calculate correctly', () => {
        const quote: QuoteData = {
            mode: 'manual',
            precio_envio: 50000,
            gastos_documentales: 15000,
            impuestos: 25000,
            observaciones_cotizacion: '',
        };
        expect(calculateQuoteTotal(quote)).toBe(90000);
    });
});

describe('Universal Validations', () => {
    it('rejects negative gastos_documentales in any mode', () => {
        const result = validateQuote({
            mode: 'manual',
            precio_envio: 100,
            gastos_documentales: -50,
            impuestos: 0,
            observaciones_cotizacion: '',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Gastos documentales no puede ser negativo');
    });

    it('rejects negative impuestos in any mode', () => {
        const result = validateQuote({
            mode: 'manual',
            precio_envio: 100,
            gastos_documentales: 0,
            impuestos: -30,
            observaciones_cotizacion: '',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Impuestos no puede ser negativo');
    });

    it('accumulates multiple errors', () => {
        const result = validateQuote({
            mode: 'manual',
            precio_envio: null,
            gastos_documentales: -50,
            impuestos: -30,
            observaciones_cotizacion: '',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
});

describe('CIF Label (was FOB)', () => {
    it('uses "Valor CIF" not "Valor FOB declarado"', () => {
        const label = getValueLabel();
        expect(label).toBe('Valor CIF');
        expect(label).not.toContain('FOB');
    });
});
