import { describe, it, expect } from 'vitest';
import {
    validateReception,
    computeReceptionStatus,
    computeReceptionDiff,
    emptyBox,
    MAX_DIM_CM, MIN_DIM_CM, MAX_WEIGHT_KG, MIN_WEIGHT_KG,
    MAX_BULK_COUNT,
} from '@/lib/reception-helpers';

// ═══════════════════════════════════════════════════════════════
// RECEPTION HELPERS — Unit Tests
// ═══════════════════════════════════════════════════════════════

describe('emptyBox', () => {
    it('returns a box with all zeros', () => {
        const box = emptyBox();
        expect(box.largo).toBe(0);
        expect(box.ancho).toBe(0);
        expect(box.alto).toBe(0);
        expect(box.peso_fisico).toBe(0);
        expect(box.peso_volumetrico).toBe(0);
        expect(box.peso_computable).toBe(0);
    });

    it('returns independent instances', () => {
        const a = emptyBox();
        const b = emptyBox();
        a.largo = 50;
        expect(b.largo).toBe(0);
    });
});

describe('computeReceptionStatus', () => {
    it('returns PENDING when 0 boxes received', () => {
        expect(computeReceptionStatus(0, 5)).toBe('PENDING');
    });

    it('returns PARTIAL when received < declared', () => {
        expect(computeReceptionStatus(2, 5)).toBe('PARTIAL');
    });

    it('returns COMPLETE when received >= declared', () => {
        expect(computeReceptionStatus(5, 5)).toBe('COMPLETE');
    });

    it('returns COMPLETE when received > declared', () => {
        expect(computeReceptionStatus(7, 5)).toBe('COMPLETE');
    });

    it('returns COMPLETE when declared is 0 and received > 0', () => {
        expect(computeReceptionStatus(3, 0)).toBe('COMPLETE');
    });
});

describe('validateReception', () => {
    const validBox = () => ({
        largo: 50, ancho: 30, alto: 20,
        peso_fisico: 10, peso_volumetrico: 5, peso_computable: 10,
    });

    const baseArgs = {
        previousBoxCount: 0,
        costoFlete: '100',
        photo1: new File([''], 'photo1.jpg'),
        photo2: new File([''], 'photo2.jpg'),
        existingPhoto1: null,
        existingPhoto2: null,
        totalComputable: 10,
    };

    it('passes with valid data', () => {
        const { errors } = validateReception({
            ...baseArgs,
            bultos: [validBox()],
        });
        expect(errors).toHaveLength(0);
    });

    it('fails when costoFlete is empty', () => {
        const { errors } = validateReception({
            ...baseArgs,
            bultos: [validBox()],
            costoFlete: '',
        });
        expect(errors.some(e => e.includes('Monto factura'))).toBe(true);
    });

    it('fails when costoFlete is 0', () => {
        const { errors } = validateReception({
            ...baseArgs,
            bultos: [validBox()],
            costoFlete: '0',
        });
        expect(errors.some(e => e.includes('Monto factura'))).toBe(true);
    });

    it('fails when no boxes have data', () => {
        const { errors } = validateReception({
            ...baseArgs,
            bultos: [emptyBox()],
        });
        expect(errors.some(e => e.includes('al menos 1 caja'))).toBe(true);
    });

    it('fails when dimension exceeds MAX_DIM_CM', () => {
        const box = validBox();
        box.largo = MAX_DIM_CM + 1;
        const { errors } = validateReception({
            ...baseArgs,
            bultos: [box],
        });
        expect(errors.some(e => e.includes(`≤ ${MAX_DIM_CM}`))).toBe(true);
    });

    it('fails when dimension below MIN_DIM_CM', () => {
        const box = validBox();
        box.ancho = 0;
        const { errors } = validateReception({
            ...baseArgs,
            bultos: [box],
        });
        expect(errors.some(e => e.includes('Ancho es obligatorio'))).toBe(true);
    });

    it('fails when weight exceeds MAX_WEIGHT_KG', () => {
        const box = validBox();
        box.peso_fisico = MAX_WEIGHT_KG + 1;
        const { errors } = validateReception({
            ...baseArgs,
            bultos: [box],
        });
        expect(errors.some(e => e.includes(`≤ ${MAX_WEIGHT_KG}`))).toBe(true);
    });

    it('fails when weight below MIN_WEIGHT_KG', () => {
        const box = validBox();
        box.peso_fisico = 0.01;
        const { errors } = validateReception({
            ...baseArgs,
            bultos: [box],
        });
        expect(errors.some(e => e.includes(`≥ ${MIN_WEIGHT_KG}`))).toBe(true);
    });

    it('fails when photo1 is missing', () => {
        const { errors } = validateReception({
            ...baseArgs,
            bultos: [validBox()],
            photo1: null,
        });
        expect(errors.some(e => e.includes('Factura 1'))).toBe(true);
    });

    it('passes when photo1 is null but existingPhoto1 is set', () => {
        const { errors } = validateReception({
            ...baseArgs,
            bultos: [validBox()],
            photo1: null,
            existingPhoto1: 'https://example.com/photo.jpg',
        });
        expect(errors.filter(e => e.includes('Factura 1'))).toHaveLength(0);
    });

    it('warns on very high volumetric weight', () => {
        const box = validBox();
        box.peso_volumetrico = 600;
        const { warnings } = validateReception({
            ...baseArgs,
            bultos: [box],
        });
        expect(warnings.some(w => w.includes('muy alto'))).toBe(true);
    });

    it('warns on very low volumetric weight', () => {
        const box = validBox();
        box.peso_volumetrico = 0.05;
        const { warnings } = validateReception({
            ...baseArgs,
            bultos: [box],
        });
        expect(warnings.some(w => w.includes('muy bajo'))).toBe(true);
    });

    it('skips validation for previously confirmed boxes', () => {
        const badBox = { largo: 0, ancho: 0, alto: 0, peso_fisico: 0, peso_volumetrico: 0, peso_computable: 0 };
        const { errors } = validateReception({
            ...baseArgs,
            bultos: [badBox, validBox()],
            previousBoxCount: 1,  // first box was already confirmed
        });
        // Should not error on box 1 (index 0) since it's a previous box
        expect(errors.filter(e => e.includes('Caja 1'))).toHaveLength(0);
    });
});

describe('computeReceptionDiff', () => {
    const validBox = () => ({
        largo: 50, ancho: 30, alto: 20,
        peso_fisico: 10, peso_volumetrico: 5, peso_computable: 10,
    });

    it('detects cost change', () => {
        const diff = computeReceptionDiff(
            [validBox()], null, null,
            { costo_flete: 50 },
            '100'
        );
        expect(diff.costo_flete).toEqual({ old: 50, new: 100 });
    });

    it('detects box count change', () => {
        const diff = computeReceptionDiff(
            [validBox(), validBox()], null, null,
            { bultos: [validBox()] },
            '100'
        );
        expect(diff.boxes_count).toEqual({ old: 1, new: 2 });
    });

    it('detects computable weight change', () => {
        const diff = computeReceptionDiff(
            [validBox()], null, null,
            { peso_computable: 5 },
            '100'
        );
        expect(diff.peso_computable).toBeDefined();
        expect(diff.peso_computable.new).toBe(10);
    });

    it('returns empty diff when nothing changed', () => {
        const box = validBox();
        const diff = computeReceptionDiff(
            [box], null, null,
            { costo_flete: 100, bultos: [box], peso_computable: 10 },
            '100'
        );
        expect(Object.keys(diff)).toHaveLength(0);
    });

    it('detects photo change', () => {
        const diff = computeReceptionDiff(
            [validBox()], 'https://new-url.jpg', null,
            { invoice_photo_1: 'https://old-url.jpg' },
            '100'
        );
        expect(diff.invoice_photo_1).toBeDefined();
    });
});

describe('constants', () => {
    it('has sane limits', () => {
        expect(MAX_DIM_CM).toBeGreaterThan(MIN_DIM_CM);
        expect(MAX_WEIGHT_KG).toBeGreaterThan(MIN_WEIGHT_KG);
        expect(MAX_BULK_COUNT).toBeGreaterThan(0);
        expect(MIN_DIM_CM).toBeGreaterThan(0);
        expect(MIN_WEIGHT_KG).toBeGreaterThan(0);
    });
});
