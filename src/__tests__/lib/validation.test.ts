import { describe, it, expect } from 'vitest';
import {
    sanitizeText,
    sanitizeLine,
    isValidTrackingNumber,
    parseNumeric,
    isValidWeight,
    isValidStatus,
    isValidRole,
    isValidCobranzaState,
    isValidPagoProveedorState,
    isValidDate,
    validateShipmentPayload,
} from '@/lib/validation';

// ─────────────────────────────────────────────────────────────
// sanitizeText
// ─────────────────────────────────────────────────────────────
describe('sanitizeText', () => {
    it('trims whitespace', () => {
        expect(sanitizeText('  hello  ')).toBe('hello');
    });

    it('enforces max length', () => {
        const long = 'a'.repeat(1000);
        expect(sanitizeText(long, 50)).toHaveLength(50);
    });

    it('removes null bytes and control characters', () => {
        expect(sanitizeText('hello\x00world\x08!')).toBe('helloworld!');
    });

    it('preserves newlines and tabs (allowed control chars)', () => {
        expect(sanitizeText('line1\nline2\ttab')).toBe('line1\nline2\ttab');
    });

    it('strips <script> tags', () => {
        expect(sanitizeText('hello<script>alert("xss")</script>world')).toBe('helloworld');
    });

    it('returns empty string for non-string input', () => {
        expect(sanitizeText(123 as any)).toBe('');
        expect(sanitizeText(null as any)).toBe('');
        expect(sanitizeText(undefined as any)).toBe('');
    });

    it('preserves Spanish/Portuguese characters', () => {
        expect(sanitizeText('¡Hola María! Ação rápida ñoño')).toBe('¡Hola María! Ação rápida ñoño');
    });

    it('defaults to max 500 chars', () => {
        const at500 = 'x'.repeat(500);
        const at501 = 'x'.repeat(501);
        expect(sanitizeText(at500)).toHaveLength(500);
        expect(sanitizeText(at501)).toHaveLength(500);
    });
});

// ─────────────────────────────────────────────────────────────
// sanitizeLine
// ─────────────────────────────────────────────────────────────
describe('sanitizeLine', () => {
    it('removes newlines', () => {
        expect(sanitizeLine('line1\nline2\rline3')).toBe('line1line2line3');
    });

    it('still trims and enforces max length', () => {
        expect(sanitizeLine('  hello  ', 10)).toBe('hello');
    });

    it('defaults to max 200 chars', () => {
        const at201 = 'x'.repeat(201);
        expect(sanitizeLine(at201)).toHaveLength(200);
    });
});

// ─────────────────────────────────────────────────────────────
// isValidTrackingNumber
// ─────────────────────────────────────────────────────────────
describe('isValidTrackingNumber', () => {
    it('accepts valid tracking numbers', () => {
        expect(isValidTrackingNumber('ABC-123')).toBe(true);
        expect(isValidTrackingNumber('TRACKING_001')).toBe(true);
        expect(isValidTrackingNumber('SF1234567890')).toBe(true);
    });

    it('rejects too short (< 3 chars)', () => {
        expect(isValidTrackingNumber('AB')).toBe(false);
        expect(isValidTrackingNumber('A')).toBe(false);
    });

    it('rejects too long (> 50 chars)', () => {
        expect(isValidTrackingNumber('A'.repeat(51))).toBe(false);
    });

    it('rejects special characters', () => {
        expect(isValidTrackingNumber('ABC 123')).toBe(false); // space
        expect(isValidTrackingNumber('ABC@123')).toBe(false); // @
        expect(isValidTrackingNumber('ABC#123')).toBe(false); // #
    });

    it('rejects empty/null/undefined', () => {
        expect(isValidTrackingNumber('')).toBe(false);
        expect(isValidTrackingNumber(null as any)).toBe(false);
        expect(isValidTrackingNumber(undefined as any)).toBe(false);
    });

    it('trims whitespace before validating', () => {
        expect(isValidTrackingNumber('  ABC-123  ')).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────
// parseNumeric
// ─────────────────────────────────────────────────────────────
describe('parseNumeric', () => {
    it('parses valid numbers', () => {
        expect(parseNumeric(42)).toBe(42);
        expect(parseNumeric('100.50')).toBe(100.50);
        expect(parseNumeric(0)).toBe(0);
    });

    it('rounds to 2 decimal places', () => {
        expect(parseNumeric(10.999)).toBe(11.00);
        expect(parseNumeric(10.994)).toBe(10.99);
        expect(parseNumeric(10.005)).toBe(10.01);
    });

    it('returns null for null/undefined/empty when allowNull=true', () => {
        expect(parseNumeric(null)).toBeNull();
        expect(parseNumeric(undefined)).toBeNull();
        expect(parseNumeric('')).toBeNull();
    });

    it('returns 0 for null/undefined/empty when allowNull=false', () => {
        expect(parseNumeric(null, { allowNull: false })).toBe(0);
        expect(parseNumeric(undefined, { allowNull: false })).toBe(0);
        expect(parseNumeric('', { allowNull: false })).toBe(0);
    });

    it('rejects NaN and Infinity', () => {
        expect(parseNumeric('abc')).toBeNull();
        expect(parseNumeric(NaN)).toBeNull();
        expect(parseNumeric(Infinity)).toBeNull();
        expect(parseNumeric(-Infinity)).toBeNull();
    });

    it('respects min/max bounds', () => {
        expect(parseNumeric(50, { min: 0, max: 100 })).toBe(50);
        expect(parseNumeric(-1, { min: 0, max: 100 })).toBeNull();  // below min
        expect(parseNumeric(101, { min: 0, max: 100 })).toBeNull(); // above max
    });

    it('uses default bounds: min=0, max=999999999', () => {
        expect(parseNumeric(-1)).toBeNull();
        expect(parseNumeric(999_999_999)).toBe(999_999_999);
        expect(parseNumeric(1_000_000_000)).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────
// isValidWeight
// ─────────────────────────────────────────────────────────────
describe('isValidWeight', () => {
    it('accepts valid weights', () => {
        expect(isValidWeight(0)).toBe(true);
        expect(isValidWeight(0.5)).toBe(true);
        expect(isValidWeight(50000)).toBe(true);
        expect(isValidWeight('25.5')).toBe(true);
    });

    it('rejects invalid weights', () => {
        expect(isValidWeight(-1)).toBe(false);
        expect(isValidWeight(50001)).toBe(false);
        expect(isValidWeight('abc')).toBe(false);
        expect(isValidWeight(NaN)).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────
// Enum validators
// ─────────────────────────────────────────────────────────────
describe('isValidStatus', () => {
    it('accepts all valid statuses', () => {
        const validStatuses = [
            'Guía Creada', 'Pendiente Expo', 'En Transito',
            'Recibido en Oficina', 'Enviado BUE', 'Cerrado/Facturado',
            'Listo Para Entregar', 'Entregado', 'Retirado',
            'Despachado', 'Mercado Libre full', 'Retenido',
        ];
        validStatuses.forEach(s => expect(isValidStatus(s)).toBe(true));
    });

    it('rejects unknown statuses', () => {
        expect(isValidStatus('unknown')).toBe(false);
        expect(isValidStatus('')).toBe(false);
        expect(isValidStatus('guía creada')).toBe(false); // case sensitive
    });
});

describe('isValidRole', () => {
    it('accepts valid roles', () => {
        ['admin', 'sales', 'logistics', 'billing', 'operator'].forEach(r =>
            expect(isValidRole(r)).toBe(true)
        );
    });

    it('rejects unknown roles', () => {
        expect(isValidRole('superadmin')).toBe(false);
        expect(isValidRole('Admin')).toBe(false); // case sensitive
        expect(isValidRole('')).toBe(false);
    });
});

describe('isValidCobranzaState', () => {
    it('accepts valid states', () => {
        ['Pendiente', 'Facturado', 'Pagado', 'Pagado Parcial'].forEach(s =>
            expect(isValidCobranzaState(s)).toBe(true)
        );
    });

    it('rejects invalid', () => {
        expect(isValidCobranzaState('pendiente')).toBe(false); // lowercase
        expect(isValidCobranzaState('Anulado')).toBe(false);
    });
});

describe('isValidPagoProveedorState', () => {
    it('accepts valid states', () => {
        expect(isValidPagoProveedorState('Pendiente')).toBe(true);
        expect(isValidPagoProveedorState('Abonado')).toBe(true);
    });

    it('rejects invalid', () => {
        expect(isValidPagoProveedorState('Pagado')).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────
// isValidDate
// ─────────────────────────────────────────────────────────────
describe('isValidDate', () => {
    it('accepts null/undefined (optional dates)', () => {
        expect(isValidDate(null)).toBe(true);
        expect(isValidDate(undefined)).toBe(true);
    });

    it('accepts valid date strings', () => {
        expect(isValidDate('2025-01-15')).toBe(true);
        expect(isValidDate('2026-12-31')).toBe(true);
        expect(isValidDate('2024-06-15T10:30:00Z')).toBe(true);
    });

    it('rejects unparseable dates', () => {
        expect(isValidDate('not-a-date')).toBe(false);
        expect(isValidDate('2025-13-45')).toBe(false); // invalid month/day
    });

    it('rejects dates far in the future (> 2100)', () => {
        // Use a year well past 2100 to avoid timezone boundary issues
        expect(isValidDate('2150-06-15')).toBe(false);
    });

    it('rejects dates before 2000', () => {
        expect(isValidDate('1990-01-01')).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────
// validateShipmentPayload (composite)
// ─────────────────────────────────────────────────────────────
describe('validateShipmentPayload', () => {
    const validPayload = {
        tracking_number: 'SF-12345',
        client_name: 'Juan Pérez',
        internal_status: 'Guía Creada',
        weight: 10,
        date_shipped: '2025-06-15',
        date_arrived: null,
    };

    it('passes for a valid payload', () => {
        const result = validateShipmentPayload(validPayload);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('fails for missing tracking number', () => {
        const result = validateShipmentPayload({ ...validPayload, tracking_number: '' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Tracking number inválido (3-50 caracteres alfanuméricos)');
    });

    it('fails for invalid tracking format', () => {
        const result = validateShipmentPayload({ ...validPayload, tracking_number: 'a@b' });
        expect(result.valid).toBe(false);
    });

    it('fails for missing client_name', () => {
        const result = validateShipmentPayload({ ...validPayload, client_name: '' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Nombre de cliente requerido (mín. 2 caracteres)');
    });

    it('fails for too short client_name', () => {
        const result = validateShipmentPayload({ ...validPayload, client_name: 'A' });
        expect(result.valid).toBe(false);
    });

    it('fails for invalid status', () => {
        const result = validateShipmentPayload({ ...validPayload, internal_status: 'Fake Status' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Estado interno inválido');
    });

    it('fails for invalid weight', () => {
        const result = validateShipmentPayload({ ...validPayload, weight: -5 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Peso inválido (0 - 50,000 kg)');
    });

    it('passes when weight is null/undefined (optional)', () => {
        const result = validateShipmentPayload({ ...validPayload, weight: null });
        expect(result.valid).toBe(true);
    });

    it('fails for invalid date_shipped', () => {
        const result = validateShipmentPayload({ ...validPayload, date_shipped: 'not-a-date' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Fecha de embarque inválida');
    });

    it('accumulates multiple errors', () => {
        const result = validateShipmentPayload({
            tracking_number: '',
            client_name: '',
            internal_status: 'bad',
            weight: -1,
            date_shipped: 'bad',
            date_arrived: 'bad',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(5);
    });
});
