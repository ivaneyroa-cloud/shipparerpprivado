import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContext, unauthorized, forbidden } from '@/lib/server-auth';

// ═══════════════════════════════════════════════════════════════
// FIELD WHITELIST PER ROLE
// ═══════════════════════════════════════════════════════════════
const FIELD_PERMISSIONS: Record<string, string[]> = {
    admin: [
        'internal_status', 'date_shipped', 'date_arrived', 'date_dispatched',
        'origin', 'tracking_number', 'category', 'weight', 'client_id', 'client_name', 'client_code',
        'precio_envio', 'gastos_documentales', 'impuestos', 'observaciones_cotizacion',
        'costo_flete', 'monto_cobrado', 'estado_cobranza', 'estado_pago_proveedor',
        'payment_proof_url', 'payment_notes',
        'retenido_nota',
        'delta_kg', 'delta_boxes', 'boxes_count',
        'reception_status', 'received_at', 'received_by', 'received_weight',
        'has_weight_anomaly', 'anomaly_percentage', 'anomaly_absolute',
        'bultos', 'peso_computable',
        'invoice_photo_1', 'invoice_photo_2',
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
        'retenido_nota', 'costo_flete',
        'reception_version_count', 'current_version_id',
        'edited_post_delivery', 'post_delivery_edit', 'edit_count',
    ],
    billing: [
        'estado_cobranza', 'estado_pago_proveedor',
        'costo_flete', 'monto_cobrado',
        'precio_envio', 'gastos_documentales', 'impuestos',
        'payment_proof_url', 'payment_notes',
    ],
    sales: [
        'precio_envio', 'gastos_documentales', 'impuestos', 'observaciones_cotizacion',
        'client_id', 'client_name', 'client_code',
    ],
};

// ═══════════════════════════════════════════════════════════════
// STATE MACHINE — Valid status transitions
// ═══════════════════════════════════════════════════════════════
const VALID_TRANSITIONS: Record<string, string[]> = {
    'Guía creada': ['Pendiente expo', 'En tránsito'],
    'Pendiente expo': ['En tránsito', 'Guía creada'],
    'En tránsito': ['Recibido en Oficina'],
    'Recibido en Oficina': ['Retirado', 'Despachado', 'Mercado Libre full', 'Retenido'],
    'Retenido': ['Recibido en Oficina', 'Retirado', 'Despachado'],
    'Retirado': [],   // terminal
    'Despachado': [],   // terminal
    'Mercado Libre full': [],   // terminal
};

// Roles that can set each status
const STATUS_ROLE_PERMISSIONS: Record<string, string[]> = {
    'Guía creada': ['admin', 'logistics', 'sales'],
    'Pendiente expo': ['admin', 'logistics'],
    'En tránsito': ['admin', 'logistics'],
    'Recibido en Oficina': ['admin', 'logistics', 'operator'],
    'Retirado': ['admin', 'operator'],
    'Despachado': ['admin', 'operator'],
    'Mercado Libre full': ['admin', 'operator'],
    'Retenido': ['admin', 'logistics', 'operator'],
};

// ═══════════════════════════════════════════════════════════════
// NUMERIC FIELDS VALIDATION
// ═══════════════════════════════════════════════════════════════
const NUMERIC_FIELDS = [
    'weight', 'precio_envio', 'gastos_documentales', 'impuestos',
    'costo_flete', 'monto_cobrado', 'delta_kg', 'delta_boxes',
    'boxes_count', 'peso_computable', 'received_weight',
    'anomaly_percentage', 'anomaly_absolute',
];

const NON_NEGATIVE_FIELDS = [
    'weight', 'precio_envio', 'gastos_documentales', 'impuestos',
    'costo_flete', 'monto_cobrado', 'boxes_count', 'peso_computable', 'received_weight',
];

// ═══════════════════════════════════════════════════════════════
// PATCH /api/shipments — Update shipment fields
// ═══════════════════════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
    const ctx = await getAuthContext(req);
    if (!ctx) return unauthorized();

    try {
        const body = await req.json();
        const { shipmentId, fields } = body;

        if (!shipmentId || typeof shipmentId !== 'string') {
            return NextResponse.json({ error: 'shipmentId requerido' }, { status: 400 });
        }

        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
            return NextResponse.json({ error: 'fields debe ser un objeto' }, { status: 400 });
        }

        const role = ctx.profile.role;
        const allowedFields = FIELD_PERMISSIONS[role] || [];

        // ── Filter and validate fields ──
        const sanitized: Record<string, any> = {};
        const rejected: string[] = [];

        for (const [key, value] of Object.entries(fields)) {
            // Skip internal fields
            if (key === 'id' || key === 'created_at' || key === 'org_id') {
                rejected.push(key);
                continue;
            }

            // Check field permission
            if (!allowedFields.includes(key)) {
                rejected.push(key);
                continue;
            }

            // Validate numeric fields
            if (NUMERIC_FIELDS.includes(key)) {
                if (value !== null && value !== '' && value !== undefined) {
                    const num = Number(value);
                    if (isNaN(num) || !isFinite(num)) {
                        return NextResponse.json(
                            { error: `Campo ${key} debe ser un número válido` },
                            { status: 400 }
                        );
                    }
                    if (NON_NEGATIVE_FIELDS.includes(key) && num < 0) {
                        return NextResponse.json(
                            { error: `Campo ${key} no puede ser negativo` },
                            { status: 400 }
                        );
                    }
                    sanitized[key] = num;
                } else {
                    sanitized[key] = null;
                }
                continue;
            }

            sanitized[key] = value;
        }

        if (Object.keys(sanitized).length === 0) {
            return NextResponse.json(
                { error: 'Ningún campo válido para actualizar', rejected },
                { status: 400 }
            );
        }

        // ── State machine validation ──
        if (sanitized.internal_status) {
            const newStatus = sanitized.internal_status;

            // Check role can set this status
            const allowedRoles = STATUS_ROLE_PERMISSIONS[newStatus];
            if (allowedRoles && !allowedRoles.includes(role)) {
                return NextResponse.json(
                    { error: `Tu rol (${role}) no puede establecer el estado "${newStatus}"` },
                    { status: 403 }
                );
            }

            // Check valid transition
            const { data: current } = await supabaseAdmin
                .from('shipments')
                .select('internal_status')
                .eq('id', shipmentId)
                .single();

            if (current) {
                const currentStatus = current.internal_status || '';
                const allowed = VALID_TRANSITIONS[currentStatus];

                if (allowed && allowed.length > 0 && !allowed.includes(newStatus)) {
                    // Admin can override terminal states
                    if (role !== 'admin') {
                        return NextResponse.json(
                            { error: `Transición inválida: "${currentStatus}" → "${newStatus}". Transiciones válidas: ${allowed.join(', ')}` },
                            { status: 400 }
                        );
                    }
                    // Admin overriding — log it
                    console.warn(`[ADMIN OVERRIDE] ${ctx.email} forced transition: ${currentStatus} → ${newStatus} on shipment ${shipmentId}`);
                }
            }
        }

        // ── Always set updated_at ──
        sanitized.updated_at = new Date().toISOString();

        // ── Execute update ──
        const { error } = await supabaseAdmin
            .from('shipments')
            .update(sanitized)
            .eq('id', shipmentId);

        if (error) {
            console.error('[API /shipments PATCH] DB error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // ── Audit log ──
        try {
            await supabaseAdmin.from('audit_log').insert({
                user_id: ctx.userId,
                user_email: ctx.email,
                action: 'shipment_update',
                target_id: shipmentId,
                details: {
                    fields_updated: Object.keys(sanitized).filter(k => k !== 'updated_at'),
                    role,
                    rejected_fields: rejected.length > 0 ? rejected : undefined,
                    status_change: sanitized.internal_status || undefined,
                },
            });
        } catch {
            // Audit log failure should not block the update
            console.warn('[AUDIT] Failed to log shipment update');
        }

        return NextResponse.json({
            success: true,
            updated: Object.keys(sanitized).filter(k => k !== 'updated_at'),
            rejected: rejected.length > 0 ? rejected : undefined,
        });

    } catch (error: any) {
        console.error('[API /shipments PATCH] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Error interno' },
            { status: 500 }
        );
    }
}
