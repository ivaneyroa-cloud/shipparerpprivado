/**
 * Input validation & sanitization utilities.
 *
 * Designed for server-side API routes and client-side form validation.
 * All functions are pure — no side effects, no DB calls.
 */

// ── String sanitization ─────────────────────────────────────────────────────

/** 
 * Strip dangerous characters from freeform text.
 * Allows letters, numbers, spaces, common punctuation in Spanish/Portuguese.
 */
export function sanitizeText(input: string, maxLength = 500): string {
    if (typeof input !== 'string') return '';
    return input
        .trim()
        .slice(0, maxLength)
        // Remove null bytes and control chars (except newline/tab)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Remove potential script tags
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

/** 
 * Sanitize for fields that should be single-line (tracking numbers, names, codes).
 * Also strips newlines.
 */
export function sanitizeLine(input: string, maxLength = 200): string {
    return sanitizeText(input, maxLength).replace(/[\r\n]/g, '');
}

// ── Tracking number validation ──────────────────────────────────────────────

/**
 * Validates a tracking/guía number.
 * Accepts: alphanumeric + dashes + underscores, 3-50 chars.
 */
export function isValidTrackingNumber(tracking: string): boolean {
    if (!tracking || typeof tracking !== 'string') return false;
    const cleaned = tracking.trim();
    return /^[A-Za-z0-9\-_]{3,50}$/.test(cleaned);
}

// ── Numeric validation ──────────────────────────────────────────────────────

/**
 * Parse and validate a numeric input.
 * Returns the number if valid and within bounds, null otherwise.
 */
export function parseNumeric(
    value: unknown,
    { min = 0, max = 999_999_999, allowNull = true }: { min?: number; max?: number; allowNull?: boolean } = {}
): number | null {
    if (value === null || value === undefined || value === '') {
        return allowNull ? null : 0;
    }
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) return allowNull ? null : 0;
    if (num < min || num > max) return allowNull ? null : 0;
    // Round to 2 decimals for currency values
    return Math.round(num * 100) / 100;
}

/**
 * Validate weight (kg). Must be positive, max 50000 kg.
 */
export function isValidWeight(weight: unknown): boolean {
    const w = parseNumeric(weight, { min: 0, max: 50_000, allowNull: true });
    return w !== null && w >= 0;
}

// ── Enum validation ────────────────────────────────────────────────────────

const VALID_STATUSES = [
    'Guía Creada', 'Pendiente Expo', 'En Transito',
    'Recibido en Oficina', 'Enviado BUE', 'Cerrado/Facturado',
    'Listo Para Entregar', 'Entregado', 'Retirado',
    'Despachado', 'Mercado Libre full', 'Retenido',
] as const;

const VALID_ROLES = ['admin', 'sales', 'logistics', 'billing', 'operator'] as const;

const VALID_COBRANZA_STATES = ['Pendiente', 'Facturado', 'Pagado', 'Pagado Parcial'] as const;

const VALID_PAGO_PROVEEDOR_STATES = ['Pendiente', 'Abonado'] as const;

export function isValidStatus(status: string): boolean {
    return VALID_STATUSES.includes(status as any);
}

export function isValidRole(role: string): boolean {
    return VALID_ROLES.includes(role as any);
}

export function isValidCobranzaState(estado: string): boolean {
    return VALID_COBRANZA_STATES.includes(estado as any);
}

export function isValidPagoProveedorState(estado: string): boolean {
    return VALID_PAGO_PROVEEDOR_STATES.includes(estado as any);
}

// ── Date validation ─────────────────────────────────────────────────────────

/**
 * Validate a date string (YYYY-MM-DD format).
 * Returns true if parseable and not in the far future (year 2100+).
 */
export function isValidDate(dateStr: string | null | undefined): boolean {
    if (!dateStr) return true; // null/undefined dates are OK (optional)
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if (d.getFullYear() > 2100 || d.getFullYear() < 2000) return false;
    return true;
}

// ── Composite shipment validation ───────────────────────────────────────────

export interface ShipmentValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateShipmentPayload(payload: Record<string, any>): ShipmentValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!payload.tracking_number || !isValidTrackingNumber(payload.tracking_number)) {
        errors.push('Tracking number inválido (3-50 caracteres alfanuméricos)');
    }
    if (!payload.client_name || payload.client_name.trim().length < 2) {
        errors.push('Nombre de cliente requerido (mín. 2 caracteres)');
    }
    if (!payload.internal_status || !isValidStatus(payload.internal_status)) {
        errors.push('Estado interno inválido');
    }

    // Numeric fields
    if (payload.weight !== undefined && payload.weight !== null) {
        if (!isValidWeight(payload.weight)) {
            errors.push('Peso inválido (0 - 50,000 kg)');
        }
    }
    if (payload.precio_envio !== undefined) {
        if (parseNumeric(payload.precio_envio, { max: 999_999 }) === null && payload.precio_envio !== 0) {
            errors.push('Precio de envío inválido');
        }
    }

    // Date fields
    if (!isValidDate(payload.date_shipped)) {
        errors.push('Fecha de embarque inválida');
    }
    if (!isValidDate(payload.date_arrived)) {
        errors.push('Fecha de llegada inválida');
    }

    return { valid: errors.length === 0, errors };
}
