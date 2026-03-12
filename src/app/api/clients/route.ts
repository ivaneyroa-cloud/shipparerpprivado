import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContext, unauthorized, forbidden } from '@/lib/server-auth';
import { sanitizeLine, sanitizeText } from '@/lib/validation';

// Roles that can manage clients
const CLIENT_ROLES = ['super_admin', 'admin', 'logistics', 'sales'];

// ═══════════════════════════════════════════════════════════════
// POST /api/clients — Create a new client
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
    const ctx = await getAuthContext(req);
    if (!ctx) return unauthorized();

    if (!CLIENT_ROLES.includes(ctx.profile.role)) {
        return forbidden('Tu rol no permite crear clientes');
    }

    try {
        const body = await req.json();

        // Validate required fields
        if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
            return NextResponse.json({ error: 'Nombre requerido (mín. 2 caracteres)' }, { status: 400 });
        }
        if (!body.code || typeof body.code !== 'string' || body.code.trim().length < 2) {
            return NextResponse.json({ error: 'Código SH requerido' }, { status: 400 });
        }

        // Sanitize inputs
        const insertData: Record<string, any> = {
            name: sanitizeLine(body.name, 200),
            code: sanitizeLine(body.code, 50).toUpperCase(),
            cuit: body.cuit ? sanitizeLine(body.cuit, 30) : null,
            address: body.address ? sanitizeText(body.address, 500) : null,
            tax_condition: body.tax_condition || 'Consumidor final',
            service_type: body.service_type || 'Retiro',
            email: body.email ? sanitizeLine(body.email, 200) : null,
            phone: body.phone ? sanitizeLine(body.phone, 50) : null,
            tarifa_aplicable: body.tarifa_aplicable || null,
        };

        // Org isolation
        if (ctx.profile.org_id) {
            insertData.org_id = ctx.profile.org_id;
        }

        if (body.assigned_to && typeof body.assigned_to === 'string') {
            insertData.assigned_to = body.assigned_to;
        }

        // Check for duplicate code
        const { data: existing } = await supabaseAdmin
            .from('clients')
            .select('id')
            .eq('code', insertData.code)
            .limit(1);

        if (existing && existing.length > 0) {
            return NextResponse.json({ error: `Ya existe un cliente con código ${insertData.code}` }, { status: 409 });
        }

        const { data, error } = await supabaseAdmin
            .from('clients')
            .insert([insertData])
            .select('id, name, code')
            .single();

        if (error) {
            console.error('[API /clients POST] DB error:', error);
            return NextResponse.json(
                { error: process.env.NODE_ENV === 'development' ? error.message : 'Error al crear cliente' },
                { status: 500 }
            );
        }

        // Audit log
        try {
            await supabaseAdmin.from('audit_log').insert({
                user_id: ctx.userId,
                user_email: ctx.email,
                action: 'client_create',
                target_id: data.id,
                details: { name: insertData.name, code: insertData.code, role: ctx.profile.role },
            });
        } catch {
            console.warn('[AUDIT] Failed to log client creation');
        }

        return NextResponse.json({ success: true, client: data });
    } catch (error: any) {
        console.error('[API /clients POST] Error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// ═══════════════════════════════════════════════════════════════
// PATCH /api/clients — Update an existing client
// ═══════════════════════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
    const ctx = await getAuthContext(req);
    if (!ctx) return unauthorized();

    if (!CLIENT_ROLES.includes(ctx.profile.role)) {
        return forbidden('Tu rol no permite editar clientes');
    }

    try {
        const body = await req.json();
        const { clientId, fields } = body;

        if (!clientId || typeof clientId !== 'string') {
            return NextResponse.json({ error: 'clientId requerido' }, { status: 400 });
        }

        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
            return NextResponse.json({ error: 'fields debe ser un objeto' }, { status: 400 });
        }

        // Allowed fields
        const ALLOWED = ['name', 'code', 'cuit', 'address', 'tax_condition', 'service_type', 'email', 'phone', 'assigned_to', 'tarifa_aplicable'];
        const sanitized: Record<string, any> = {};

        for (const [key, value] of Object.entries(fields)) {
            if (!ALLOWED.includes(key)) continue;
            if (typeof value === 'string') {
                sanitized[key] = key === 'address' ? sanitizeText(value, 500) : sanitizeLine(value as string, 200);
            } else {
                sanitized[key] = value;
            }
        }

        if (Object.keys(sanitized).length === 0) {
            return NextResponse.json({ error: 'Ningún campo válido para actualizar' }, { status: 400 });
        }



        const { error } = await supabaseAdmin
            .from('clients')
            .update(sanitized)
            .eq('id', clientId);

        if (error) {
            console.error('[API /clients PATCH] DB error:', error);
            return NextResponse.json(
                { error: process.env.NODE_ENV === 'development' ? error.message : 'Error al actualizar cliente' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, updated: Object.keys(sanitized).filter(k => k !== 'updated_at') });
    } catch (error: any) {
        console.error('[API /clients PATCH] Error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
