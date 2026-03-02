import { describe, it, expect } from 'vitest';
import { parseMessage, getMissingFields } from '@/lib/chat/parser';
import { calcVolumetric, roundToHalfKg, computeWeights } from '@/lib/chat/calculator';
import { generateAlerts, hasHardStop } from '@/lib/chat/alert-engine';

// ═══════════════════════════════════════════════════════════════
// PARSER TESTS
// ═══════════════════════════════════════════════════════════════
describe('Parser', () => {
    describe('dimensions', () => {
        it('parses 60x50x40', () => {
            const r = parseMessage('Medidas 60x50x40');
            expect(r.dims_cm).toEqual({ l: 60, w: 50, h: 40 });
        });

        it('parses 60*50*40', () => {
            const r = parseMessage('Son 60*50*40 las medidas');
            expect(r.dims_cm).toEqual({ l: 60, w: 50, h: 40 });
        });

        it('parses 60cm x 50cm x 40cm', () => {
            const r = parseMessage('Medidas 60cm x 50cm x 40cm');
            expect(r.dims_cm).toEqual({ l: 60, w: 50, h: 40 });
        });

        it('parses decimal dimensions 60.5x50.3x40.1', () => {
            const r = parseMessage('60.5x50.3x40.1');
            expect(r.dims_cm?.l).toBeCloseTo(60.5);
        });

        it('returns null if no dimensions found', () => {
            const r = parseMessage('Hola quiero cotizar');
            expect(r.dims_cm).toBeNull();
        });
    });

    describe('weight', () => {
        it('parses 18kg', () => {
            const r = parseMessage('Son 18kg');
            expect(r.peso_real_kg).toBe(18);
        });

        it('parses 18 kg', () => {
            const r = parseMessage('Peso 18 kg total');
            expect(r.peso_real_kg).toBe(18);
        });

        it('parses 18 kilos', () => {
            const r = parseMessage('Pesa 18 kilos');
            expect(r.peso_real_kg).toBe(18);
        });

        it('parses decimal weight 18.5kg', () => {
            const r = parseMessage('Son 18.5kg');
            expect(r.peso_real_kg).toBe(18.5);
        });
    });

    describe('quoted weight', () => {
        it('detects "cotizo 18kg"', () => {
            const r = parseMessage('Voy a cotizar 18kg');
            expect(r.quoted_weight_kg).toBe(18);
        });

        it('detects "cotizo por 18"', () => {
            const r = parseMessage('Cotizo por 18');
            expect(r.quoted_weight_kg).toBe(18);
        });
    });

    describe('route', () => {
        it('detects china', () => {
            const r = parseMessage('Envío desde China');
            expect(r.route).toBe('china');
        });

        it('detects USA', () => {
            const r = parseMessage('Viene de Miami');
            expect(r.route).toBe('usa');
        });

        it('returns null for unknown route', () => {
            const r = parseMessage('Envío de prueba');
            expect(r.route).toBeNull();
        });
    });

    describe('service', () => {
        it('detects express', () => {
            const r = parseMessage('China express');
            expect(r.service).toBe('express');
        });

        it('detects standard', () => {
            const r = parseMessage('Quiero maritimo');
            expect(r.service).toBe('standard');
        });
    });

    describe('flags', () => {
        it('detects batería', () => {
            const r = parseMessage('Tiene batería de litio');
            expect(r.flags).toContain('bateria');
        });

        it('detects líquido', () => {
            const r = parseMessage('Es un líquido');
            expect(r.flags).toContain('liquido');
        });

        it('detects marca', () => {
            const r = parseMessage('Es Nike original');
            expect(r.flags).toContain('marca');
        });

        it('detects multiple flags', () => {
            const r = parseMessage('Tiene batería y es marca Nike');
            expect(r.flags).toContain('bateria');
            expect(r.flags).toContain('marca');
        });
    });

    describe('complex messages', () => {
        it('parses full message: "Voy a cotizar 18kg. Medidas 60x50x40. China express."', () => {
            const r = parseMessage('Voy a cotizar 18kg. Medidas 60x50x40. China express.');
            expect(r.peso_real_kg).toBe(18);
            expect(r.dims_cm).toEqual({ l: 60, w: 50, h: 40 });
            expect(r.route).toBe('china');
            expect(r.service).toBe('express');
            expect(r.quoted_weight_kg).toBe(18);
        });
    });

    describe('missing fields', () => {
        it('reports missing peso/medidas', () => {
            const r = parseMessage('Envío desde China');
            expect(getMissingFields(r)).toContain('peso o medidas');
        });

        it('reports missing route', () => {
            const r = parseMessage('18kg 60x50x40');
            expect(getMissingFields(r)).toContain('ruta/origen');
        });

        it('reports nothing missing when complete', () => {
            const r = parseMessage('18kg 60x50x40 China');
            expect(getMissingFields(r)).toHaveLength(0);
        });
    });
});

// ═══════════════════════════════════════════════════════════════
// CALCULATOR TESTS
// ═══════════════════════════════════════════════════════════════
describe('Calculator', () => {
    it('calculates volumetric weight: 60x50x40 = 24.0', () => {
        expect(calcVolumetric(60, 50, 40)).toBe(24);
    });

    it('calculates volumetric weight: 100x80x60 = 96.0', () => {
        expect(calcVolumetric(100, 80, 60)).toBe(96);
    });

    it('rounds 24.1 → 24.5', () => {
        expect(roundToHalfKg(24.1)).toBe(24.5);
    });

    it('rounds 24.0 → 24.0', () => {
        expect(roundToHalfKg(24.0)).toBe(24);
    });

    it('rounds 23.7 → 24.0', () => {
        expect(roundToHalfKg(23.7)).toBe(24);
    });

    it('rounds 0.3 → 0.5', () => {
        expect(roundToHalfKg(0.3)).toBe(0.5);
    });

    it('computeWeights picks max of real and volumetric', () => {
        const r = computeWeights(18, { l: 60, w: 50, h: 40 });
        expect(r).not.toBeNull();
        expect(r!.peso_cotizable_kg).toBe(24);
    });

    it('computeWeights with only real weight', () => {
        const r = computeWeights(18, null);
        expect(r).not.toBeNull();
        expect(r!.peso_cotizable_kg).toBe(18);
    });

    it('computeWeights with only dims', () => {
        const r = computeWeights(null, { l: 60, w: 50, h: 40 });
        expect(r).not.toBeNull();
        expect(r!.peso_cotizable_kg).toBe(24);
    });

    it('computeWeights returns null with no data', () => {
        const r = computeWeights(null, null);
        expect(r).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════
// ALERT ENGINE TESTS
// ═══════════════════════════════════════════════════════════════
describe('Alert Engine', () => {
    it('generates CRITICAL for liquids', () => {
        const parsed = parseMessage('Es un líquido');
        const alerts = generateAlerts(parsed, null);
        expect(alerts[0].severity).toBe('CRITICAL');
        expect(alerts[0].type).toBe('PROHIBITED_ITEM');
        expect(alerts[0].hard_stop).toBe(true);
    });

    it('generates HIGH for brand items', () => {
        const parsed = parseMessage('Es Nike original 18kg');
        const alerts = generateAlerts(parsed, null);
        expect(alerts.some(a => a.type === 'ESCALATE_TO_ADMIN')).toBe(true);
    });

    it('generates HIGH for weight mismatch', () => {
        const parsed = parseMessage('Cotizo 18kg. 60x50x40. China express.');
        const computed = computeWeights(parsed.peso_real_kg, parsed.dims_cm);
        const alerts = generateAlerts(parsed, computed);
        expect(alerts.some(a => a.type === 'WEIGHT_MISMATCH')).toBe(true);
    });

    it('generates MEDIUM for battery', () => {
        const parsed = parseMessage('Tiene batería de litio, 5kg');
        const alerts = generateAlerts(parsed, null);
        expect(alerts.some(a => a.type === 'RECOMMEND_DEPOSITO')).toBe(true);
    });

    it('generates LOW for missing data', () => {
        const parsed = parseMessage('Hola quiero cotizar algo');
        const alerts = generateAlerts(parsed, null);
        expect(alerts.some(a => a.type === 'MISSING_DATA')).toBe(true);
    });

    it('hasHardStop returns true for CRITICAL alerts', () => {
        const parsed = parseMessage('Quiero enviar un líquido');
        const alerts = generateAlerts(parsed, null);
        expect(hasHardStop(alerts)).toBe(true);
    });

    it('hasHardStop returns false for normal messages', () => {
        const parsed = parseMessage('18kg 60x50x40 China express');
        const computed = computeWeights(parsed.peso_real_kg, parsed.dims_cm);
        const alerts = generateAlerts(parsed, computed);
        expect(hasHardStop(alerts)).toBe(false);
    });

    it('no alerts for clean message with correct weight', () => {
        const parsed = parseMessage('Cotizo 24kg. 60x50x40. China express.');
        const computed = computeWeights(parsed.peso_real_kg, parsed.dims_cm);
        const alerts = generateAlerts(parsed, computed);
        // Should not have WEIGHT_MISMATCH since quoted = cotizable
        expect(alerts.filter(a => a.type === 'WEIGHT_MISMATCH')).toHaveLength(0);
    });
});
