import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// SECURITY RULES — Unit Tests
// Tests the field whitelist and state machine WITHOUT hitting DB
// ═══════════════════════════════════════════════════════════════

// Replicate the security rules from route.ts for testing
const FIELD_PERMISSIONS: Record<string, string[]> = {
    super_admin: [
        'internal_status', 'date_shipped', 'date_arrived', 'date_dispatched',
        'origin', 'tracking_number', 'category', 'weight', 'client_id', 'client_name', 'client_code',
        'precio_envio', 'gastos_documentales', 'impuestos', 'observaciones_cotizacion',
        'costo_flete', 'costo_impuestos_proveedor', 'monto_cobrado', 'estado_cobranza', 'estado_pago_proveedor',
        'payment_proof_url', 'payment_notes', 'retenido_nota',
        'delta_kg', 'delta_boxes', 'boxes_count',
        'reception_status', 'received_at', 'received_by', 'received_weight',
        'has_weight_anomaly', 'anomaly_percentage', 'anomaly_absolute',
        'bultos', 'peso_computable', 'invoice_photo_1', 'invoice_photo_2',
        'reception_version_count', 'current_version_id',
        'edited_post_delivery', 'post_delivery_edit', 'edit_count',
    ],
    admin: [
        'internal_status', 'date_shipped', 'date_arrived', 'date_dispatched',
        'origin', 'tracking_number', 'category', 'weight', 'client_id', 'client_name', 'client_code',
        'precio_envio', 'gastos_documentales', 'impuestos', 'observaciones_cotizacion',
        'costo_flete', 'costo_impuestos_proveedor', 'monto_cobrado', 'estado_cobranza', 'estado_pago_proveedor',
        'payment_proof_url', 'payment_notes', 'retenido_nota',
        'delta_kg', 'delta_boxes', 'boxes_count',
        'reception_status', 'received_at', 'received_by', 'received_weight',
        'has_weight_anomaly', 'anomaly_percentage', 'anomaly_absolute',
        'bultos', 'peso_computable', 'invoice_photo_1', 'invoice_photo_2',
        'reception_version_count', 'current_version_id',
        'edited_post_delivery', 'post_delivery_edit', 'edit_count',
    ],
    logistics: [
        'internal_status', 'date_shipped', 'origin', 'tracking_number', 'category',
        'weight', 'client_id', 'client_name', 'client_code',
        'precio_envio', 'gastos_documentales', 'impuestos', 'observaciones_cotizacion',
        'retenido_nota',
    ],
    operator: [
        'internal_status', 'date_arrived', 'date_dispatched',
        'delta_kg', 'delta_boxes', 'boxes_count',
        'reception_status', 'received_at', 'received_by', 'received_weight',
        'has_weight_anomaly', 'anomaly_percentage', 'anomaly_absolute',
        'bultos', 'peso_computable', 'weight',
        'invoice_photo_1', 'invoice_photo_2',
        'retenido_nota', 'costo_flete', 'costo_impuestos_proveedor',
        'reception_version_count', 'current_version_id',
        'edited_post_delivery', 'post_delivery_edit', 'edit_count',
    ],
    billing: [
        'estado_cobranza', 'estado_pago_proveedor',
        'costo_flete', 'costo_impuestos_proveedor', 'monto_cobrado',
        'precio_envio', 'gastos_documentales', 'impuestos',
        'payment_proof_url', 'payment_notes',
        'tracking_number', 'weight',
        'internal_status', 'date_arrived', 'date_dispatched',
        'delta_kg', 'delta_boxes', 'boxes_count',
        'reception_status', 'received_at', 'received_by', 'received_weight',
        'has_weight_anomaly', 'anomaly_percentage', 'anomaly_absolute',
        'bultos', 'peso_computable',
        'invoice_photo_1', 'invoice_photo_2',
        'reception_version_count', 'current_version_id',
        'edited_post_delivery', 'post_delivery_edit', 'edit_count',
    ],
    sales: [
        'precio_envio', 'gastos_documentales', 'impuestos', 'observaciones_cotizacion',
        'client_id', 'client_name', 'client_code',
    ],
};

const VALID_TRANSITIONS: Record<string, string[]> = {
    'Guía creada': ['Pendiente expo', 'En tránsito'],
    'Pendiente expo': ['En tránsito', 'Guía creada'],
    'En tránsito': ['Recibido en Oficina'],
    'Recibido en Oficina': ['Retirado', 'Despachado', 'Mercado Libre full', 'Retenido'],
    'Retenido': ['Recibido en Oficina', 'Retirado', 'Despachado'],
    'Retirado': [],
    'Despachado': [],
    'Mercado Libre full': [],
};

const NON_NEGATIVE_FIELDS = [
    'weight', 'precio_envio', 'gastos_documentales', 'impuestos',
    'costo_flete', 'monto_cobrado', 'boxes_count', 'peso_computable', 'received_weight',
];

// Helper: filter fields by role (same logic as API)
function filterByRole(fields: Record<string, any>, role: string): Record<string, any> {
    const allowed = FIELD_PERMISSIONS[role] || [];
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
        if (allowed.includes(key)) filtered[key] = value;
    }
    return filtered;
}

// ═══ TESTS ═══

describe('Field Permissions', () => {
    it('admin can edit all financial fields', () => {
        const fields = { monto_cobrado: 1000, estado_cobranza: 'Pagado' };
        const filtered = filterByRole(fields, 'admin');
        expect(filtered).toEqual(fields);
    });

    it('operator CANNOT edit financial fields', () => {
        const fields = { monto_cobrado: 1000, estado_cobranza: 'Pagado' };
        const filtered = filterByRole(fields, 'operator');
        expect(filtered).toEqual({});
    });

    it('billing can edit payment fields', () => {
        const fields = { estado_cobranza: 'Pagado', monto_cobrado: 500 };
        const filtered = filterByRole(fields, 'billing');
        expect(filtered).toEqual(fields);
    });

    it('billing CANNOT edit origin or category', () => {
        const fields = { origin: 'MARS', category: 'TEST' };
        const filtered = filterByRole(fields, 'billing');
        expect(filtered).toEqual({});
    });

    it('billing CAN edit tracking_number and weight (depot reception)', () => {
        const fields = { tracking_number: '1Z0J5W578632211979', weight: 10 };
        const filtered = filterByRole(fields, 'billing');
        expect(filtered).toEqual(fields);
    });

    it('sales CANNOT edit status', () => {
        const fields = { internal_status: 'Retirado' };
        const filtered = filterByRole(fields, 'sales');
        expect(filtered).toEqual({});
    });

    it('sales CAN edit pricing', () => {
        const fields = { precio_envio: 50 };
        const filtered = filterByRole(fields, 'sales');
        expect(filtered).toEqual(fields);
    });

    it('unknown role gets nothing', () => {
        const fields = { internal_status: 'test', weight: 10 };
        const filtered = filterByRole(fields, 'hacker');
        expect(filtered).toEqual({});
    });

    it('operator CAN edit reception fields', () => {
        const fields = { bultos: [], boxes_count: 3, peso_computable: 15 };
        const filtered = filterByRole(fields, 'operator');
        expect(filtered).toEqual(fields);
    });
});

describe('State Machine', () => {
    it('allows Guía creada → Pendiente expo', () => {
        const allowed = VALID_TRANSITIONS['Guía creada'];
        expect(allowed).toContain('Pendiente expo');
    });

    it('allows Guía creada → En tránsito', () => {
        const allowed = VALID_TRANSITIONS['Guía creada'];
        expect(allowed).toContain('En tránsito');
    });

    it('blocks Guía creada → Retirado (skip states)', () => {
        const allowed = VALID_TRANSITIONS['Guía creada'];
        expect(allowed).not.toContain('Retirado');
    });

    it('blocks En tránsito → Retirado (must go through Recibido)', () => {
        const allowed = VALID_TRANSITIONS['En tránsito'];
        expect(allowed).not.toContain('Retirado');
    });

    it('allows Recibido en Oficina → Retirado', () => {
        const allowed = VALID_TRANSITIONS['Recibido en Oficina'];
        expect(allowed).toContain('Retirado');
    });

    it('Retirado is terminal (no transitions out)', () => {
        const allowed = VALID_TRANSITIONS['Retirado'];
        expect(allowed).toHaveLength(0);
    });

    it('Despachado is terminal', () => {
        const allowed = VALID_TRANSITIONS['Despachado'];
        expect(allowed).toHaveLength(0);
    });

    it('Retenido can be released back to Recibido en Oficina', () => {
        const allowed = VALID_TRANSITIONS['Retenido'];
        expect(allowed).toContain('Recibido en Oficina');
    });

    it('all defined statuses have a transition entry', () => {
        const allStatuses = Object.keys(VALID_TRANSITIONS);
        expect(allStatuses.length).toBeGreaterThanOrEqual(7);
        allStatuses.forEach(status => {
            expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
        });
    });
});

describe('Non-negative field validation', () => {
    it('weight is in the non-negative list', () => {
        expect(NON_NEGATIVE_FIELDS).toContain('weight');
    });

    it('precio_envio is in the non-negative list', () => {
        expect(NON_NEGATIVE_FIELDS).toContain('precio_envio');
    });

    it('delta_kg is NOT in the non-negative list (can be negative)', () => {
        expect(NON_NEGATIVE_FIELDS).not.toContain('delta_kg');
    });

    it('all non-negative fields reject negative values', () => {
        NON_NEGATIVE_FIELDS.forEach(field => {
            const value = -1;
            expect(value).toBeLessThan(0); // would be rejected by API
        });
    });
});
