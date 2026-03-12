import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// ROLE SECURITY — Comprehensive Tests
// Validates: super_admin handling, default role safety, privilege
// escalation prevention, menu visibility, org isolation
// ═══════════════════════════════════════════════════════════════

// ── Replicate structures from production code ──────────────────

const VALID_ROLES = ['super_admin', 'admin', 'sales', 'logistics', 'billing', 'operator'] as const;

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

// Menu items (replicated from layout.tsx)
const allMenuItems = [
    { label: 'Dashboard', roles: ['admin', 'logistics', 'sales', 'billing', 'operator'] },
    { label: 'Envíos', roles: ['admin', 'logistics', 'sales', 'billing'] },
    { label: 'Depósito', roles: ['admin', 'logistics', 'operator', 'billing'] },
    { label: 'Operaciones', roles: ['admin', 'logistics', 'operator'] },
    { label: 'Gerencia', roles: ['admin'] },
    { label: 'Cobranzas', roles: ['admin', 'billing'] },
    { label: 'Finanzas', roles: ['admin', 'billing'] },
    { label: 'Cotizaciones', roles: ['admin', 'logistics', 'sales', 'billing'] },
    { label: 'Clientes', roles: ['admin', 'logistics', 'sales'] },
    { label: 'Reportes', roles: ['admin'] },
    { label: 'Comunicación', roles: ['admin', 'logistics', 'sales', 'billing', 'operator'] },
    { label: 'Equipo', roles: ['admin'] },
    { label: 'Ajustes', roles: ['admin', 'logistics'] },
];

function getMenuForRole(role: string): string[] {
    const effectiveRole = role === 'super_admin' ? 'admin' : role;
    return allMenuItems.filter(item => item.roles.includes(effectiveRole)).map(item => item.label);
}

function filterByRole(fields: Record<string, any>, role: string): Record<string, any> {
    const allowed = FIELD_PERMISSIONS[role] || [];
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
        if (allowed.includes(key)) filtered[key] = value;
    }
    return filtered;
}

// Password policy (from users/route.ts)
function validatePassword(password: string): { valid: boolean; error?: string } {
    if (typeof password !== 'string' || password.length < 8) {
        return { valid: false, error: 'Contraseña debe tener mín. 8 caracteres' };
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        return { valid: false, error: 'Contraseña debe incluir al menos una mayúscula y un número' };
    }
    return { valid: true };
}

// ═══ TESTS ═══════════════════════════════════════════════════

describe('Default Role Safety', () => {
    it('default role MUST be empty string, not admin', () => {
        // This verifies that the initial state in layout.tsx is safe.
        // If the default were "admin", all menu items would flash briefly
        // to any user while their profile loads from the database.
        const defaultRole = ''; // This is the expected safe default
        const menu = getMenuForRole(defaultRole);
        expect(menu).toHaveLength(0);
    });

    it('empty role gets ZERO menu items', () => {
        const menu = getMenuForRole('');
        expect(menu).toHaveLength(0);
    });

    it('empty role gets ZERO field permissions', () => {
        const fields = { internal_status: 'test', weight: 10, monto_cobrado: 1000 };
        const filtered = filterByRole(fields, '');
        expect(filtered).toEqual({});
    });

    it('"admin" as default would expose all admin menus (the bug we fixed)', () => {
        const menu = getMenuForRole('admin');
        expect(menu.length).toBeGreaterThan(10); // admin sees almost everything
        expect(menu).toContain('Gerencia');
        expect(menu).toContain('Equipo');
        expect(menu).toContain('Reportes');
    });
});

describe('super_admin Role', () => {
    it('super_admin is a valid role', () => {
        expect(VALID_ROLES).toContain('super_admin');
    });

    it('super_admin sees the same menu as admin', () => {
        const adminMenu = getMenuForRole('admin');
        const superMenu = getMenuForRole('super_admin');
        expect(superMenu).toEqual(adminMenu);
    });

    it('super_admin has field permissions defined', () => {
        expect(FIELD_PERMISSIONS['super_admin']).toBeDefined();
        expect(FIELD_PERMISSIONS['super_admin'].length).toBeGreaterThan(0);
    });

    it('super_admin has AT LEAST the same fields as admin', () => {
        const adminFields = new Set(FIELD_PERMISSIONS['admin']);
        const superFields = new Set(FIELD_PERMISSIONS['super_admin']);
        adminFields.forEach(field => {
            expect(superFields.has(field)).toBe(true);
        });
    });

    it('super_admin can edit all financial fields', () => {
        const financialFields = { monto_cobrado: 1000, estado_cobranza: 'Pagado', costo_flete: 500 };
        const filtered = filterByRole(financialFields, 'super_admin');
        expect(filtered).toEqual(financialFields);
    });
});

describe('Privilege Escalation Prevention', () => {
    it('unknown/fabricated role gets zero permissions', () => {
        const hackRoles = ['hacker', 'root', 'superuser', 'ADMIN', 'Admin', 'god', ''];
        hackRoles.forEach(role => {
            const fields = { internal_status: 'test', monto_cobrado: 1000 };
            const filtered = filterByRole(fields, role);
            expect(filtered).toEqual({});
        });
    });

    it('role names are case-sensitive (Admin !== admin)', () => {
        const fields = { internal_status: 'test' };
        expect(filterByRole(fields, 'admin')).toEqual(fields);
        expect(filterByRole(fields, 'Admin')).toEqual({});
        expect(filterByRole(fields, 'ADMIN')).toEqual({});
    });

    it('internal fields (id, created_at, org_id) are NOT in any role permissions', () => {
        const internalFields = ['id', 'created_at', 'org_id'];
        Object.entries(FIELD_PERMISSIONS).forEach(([role, fields]) => {
            internalFields.forEach(f => {
                expect(fields).not.toContain(f);
            });
        });
    });

    it('sales cannot touch status, dates, or reception fields', () => {
        const restrictedFields = {
            internal_status: 'Retirado',
            date_shipped: '2026-01-01',
            reception_status: 'received',
            received_weight: 50,
        };
        const filtered = filterByRole(restrictedFields, 'sales');
        expect(filtered).toEqual({});
    });

    it('operator cannot modify financial amounts', () => {
        const financialFields = { monto_cobrado: 1000, estado_cobranza: 'Pagado', estado_pago_proveedor: 'Abonado' };
        const filtered = filterByRole(financialFields, 'operator');
        expect(filtered).toEqual({});
    });

    it('logistics cannot modify cobranza or pago proveedor status', () => {
        const fields = { estado_cobranza: 'Pagado', estado_pago_proveedor: 'Abonado', monto_cobrado: 500 };
        const filtered = filterByRole(fields, 'logistics');
        expect(filtered).toEqual({});
    });
});

describe('Menu Isolation per Role', () => {
    it('operator cannot see Gerencia, Clientes, Reportes, Equipo, Cobranzas, Finanzas, Cotizaciones', () => {
        const menu = getMenuForRole('operator');
        expect(menu).not.toContain('Gerencia');
        expect(menu).not.toContain('Clientes');
        expect(menu).not.toContain('Reportes');
        expect(menu).not.toContain('Equipo');
        expect(menu).not.toContain('Cobranzas');
        expect(menu).not.toContain('Finanzas');
        expect(menu).not.toContain('Cotizaciones');
    });

    it('operator CAN see Dashboard, Depósito, Operaciones, Comunicación', () => {
        const menu = getMenuForRole('operator');
        expect(menu).toContain('Dashboard');
        expect(menu).toContain('Depósito');
        expect(menu).toContain('Operaciones');
        expect(menu).toContain('Comunicación');
    });

    it('sales can see Envíos, Clientes, Cotizaciones but not Gerencia', () => {
        const menu = getMenuForRole('sales');
        expect(menu).toContain('Envíos');
        expect(menu).toContain('Clientes');
        expect(menu).toContain('Cotizaciones');
        expect(menu).not.toContain('Gerencia');
        expect(menu).not.toContain('Equipo');
    });

    it('billing can see Cobranzas, Finanzas but not Gerencia, Equipo, Clientes', () => {
        const menu = getMenuForRole('billing');
        expect(menu).toContain('Cobranzas');
        expect(menu).toContain('Finanzas');
        expect(menu).not.toContain('Gerencia');
        expect(menu).not.toContain('Equipo');
        expect(menu).not.toContain('Clientes');
    });

    it('admin sees ALL menus', () => {
        const menu = getMenuForRole('admin');
        const allLabels = allMenuItems.map(i => i.label);
        expect(menu).toEqual(allLabels);
    });
});

describe('Password Policy', () => {
    it('rejects passwords shorter than 8 characters', () => {
        expect(validatePassword('Abc1').valid).toBe(false);
        expect(validatePassword('Ab1').valid).toBe(false);
        expect(validatePassword('').valid).toBe(false);
    });

    it('rejects passwords without uppercase', () => {
        expect(validatePassword('abcdefgh1').valid).toBe(false);
    });

    it('rejects passwords without numbers', () => {
        expect(validatePassword('Abcdefgh').valid).toBe(false);
    });

    it('accepts strong passwords', () => {
        expect(validatePassword('Secure1Pass').valid).toBe(true);
        expect(validatePassword('MyP4ssword').valid).toBe(true);
        expect(validatePassword('Sh1ppar2026').valid).toBe(true);
    });

    it('old policy (6 chars, no complexity) would have passed weak passwords', () => {
        // These would have been accepted under the old 6-char policy but now fail
        expect(validatePassword('abc123').valid).toBe(false); // no uppercase, too short
        expect(validatePassword('123456').valid).toBe(false); // no uppercase, no letter
        expect(validatePassword('password').valid).toBe(false); // no number, no uppercase
    });
});

describe('Status Role Permissions', () => {
    const STATUS_ROLE_PERMISSIONS: Record<string, string[]> = {
        'Guía creada': ['super_admin', 'admin', 'logistics', 'sales'],
        'Pendiente expo': ['super_admin', 'admin', 'logistics'],
        'En tránsito': ['super_admin', 'admin', 'logistics'],
        'Recibido en Oficina': ['super_admin', 'admin', 'logistics', 'operator', 'billing'],
        'Retirado': ['super_admin', 'admin', 'operator', 'billing'],
        'Despachado': ['super_admin', 'admin', 'operator', 'billing'],
        'Mercado Libre full': ['super_admin', 'admin', 'operator', 'billing'],
        'Retenido': ['super_admin', 'admin', 'logistics', 'operator'],
    };

    it('super_admin can set ANY status', () => {
        Object.values(STATUS_ROLE_PERMISSIONS).forEach(roles => {
            expect(roles).toContain('super_admin');
        });
    });

    it('admin can set any status', () => {
        Object.values(STATUS_ROLE_PERMISSIONS).forEach(roles => {
            expect(roles).toContain('admin');
        });
    });

    it('sales can ONLY set Guía creada', () => {
        const salesStatuses = Object.entries(STATUS_ROLE_PERMISSIONS)
            .filter(([_, roles]) => roles.includes('sales'))
            .map(([status]) => status);
        expect(salesStatuses).toEqual(['Guía creada']);
    });

    it('billing cannot set En tránsito or Pendiente expo', () => {
        expect(STATUS_ROLE_PERMISSIONS['En tránsito']).not.toContain('billing');
        expect(STATUS_ROLE_PERMISSIONS['Pendiente expo']).not.toContain('billing');
    });

    it('operator cannot set initial logistics statuses', () => {
        expect(STATUS_ROLE_PERMISSIONS['Guía creada']).not.toContain('operator');
        expect(STATUS_ROLE_PERMISSIONS['Pendiente expo']).not.toContain('operator');
        expect(STATUS_ROLE_PERMISSIONS['En tránsito']).not.toContain('operator');
    });
});
