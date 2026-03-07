import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';
import { logAudit } from '@/lib/audit';
import { sanitizeLine } from '@/lib/validation';

export async function POST(req: NextRequest) {
    try {
        // Verify the requesting user is authenticated and is admin
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user: requestingUser } } = await supabase.auth.getUser(token);

        if (!requestingUser) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // Check if requesting user is admin
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', requestingUser.id)
            .single();

        if (!profile || profile.role !== 'admin') {
            return NextResponse.json({ error: 'Solo administradores pueden crear usuarios' }, { status: 403 });
        }

        const body = await req.json();
        const { email, password, full_name, role } = body;

        if (!email || !password || !full_name || !role) {
            return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
        }

        const validRoles = ['admin', 'logistics', 'sales', 'billing', 'operator'];
        if (!validRoles.includes(role)) {
            return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
        }

        // Create user in Supabase Auth
        // Note: Supabase may have a DB trigger (handle_new_user) that tries to auto-create 
        // a profile row. If that trigger fails (e.g. missing fields), the auth user may still 
        // be created. We handle both cases.
        let userId: string | null = null;

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name, role }
        });

        if (createError) {
            console.error('Supabase createUser error:', createError.message);

            // Check if the user was actually created despite the trigger error
            if (createError.message?.includes('Database error') || createError.message?.includes('database')) {
                // The auth user might exist — try to find them
                const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
                const existingUser = listData?.users?.find((u: any) => u.email === email);

                if (existingUser) {
                    console.log('User was created despite trigger error, proceeding with profile setup');
                    userId = existingUser.id;
                } else {
                    return NextResponse.json({ error: createError.message || 'Error al crear usuario en Auth' }, { status: 400 });
                }
            } else {
                return NextResponse.json({ error: createError.message || 'Error al crear usuario en Auth' }, { status: 400 });
            }
        } else {
            userId = newUser.user?.id ?? null;
        }

        // Create/update the profile with org_id from the requesting admin
        if (userId) {
            // Fetch admin's org_id to assign to the new user (same org)
            const { data: adminProfile } = await supabaseAdmin
                .from('profiles')
                .select('org_id')
                .eq('id', requestingUser.id)
                .single();

            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: userId,
                    email,
                    full_name,
                    role,
                    org_id: adminProfile?.org_id ?? null,
                    is_active: true
                });

            if (profileError) {
                console.error('Profile upsert error:', profileError.message);
                // Non-fatal — user is created, profile will need manual fix
            }
        }

        // Audit: user creation
        await logAudit({
            actorId: requestingUser.id,
            actorEmail: requestingUser.email || '',
            action: 'create_user',
            targetTable: 'profiles',
            targetId: userId || undefined,
            newValues: { email, full_name, role },
        });

        return NextResponse.json({
            success: true,
            user: {
                id: userId,
                email,
                full_name,
                role
            }
        });

    } catch (error: any) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user } } = await supabase.auth.getUser(token);

        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // Check if requesting user is admin
        const { data: reqProfile } = await supabaseAdmin
            .from('profiles')
            .select('role, org_id')
            .eq('id', user.id)
            .single();

        if (!reqProfile) {
            return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
        }

        const isAdmin = reqProfile.role === 'admin';

        // Admin gets full details; other roles get minimal data for task assignment
        const columns = isAdmin
            ? 'id, email, full_name, role, is_active, created_at, org_id'
            : 'id, full_name, role';

        const query = supabaseAdmin
            .from('profiles')
            .select(columns)
            .eq('is_active', true)
            .order('created_at', { ascending: true });

        if (reqProfile.org_id) {
            query.eq('org_id', reqProfile.org_id);
        }

        const { data: profiles, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ users: profiles });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user: requestingUser } } = await supabase.auth.getUser(token);

        if (!requestingUser) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', requestingUser.id)
            .single();

        if (!profile || profile.role !== 'admin') {
            return NextResponse.json({ error: 'Solo administradores pueden modificar usuarios' }, { status: 403 });
        }

        const body = await req.json();
        const { userId, updates } = body;

        if (!userId || typeof userId !== 'string') {
            return NextResponse.json({ error: 'userId es obligatorio' }, { status: 400 });
        }

        // ── FIELD WHITELIST — only these fields can be updated ──
        const ALLOWED_FIELDS = ['role', 'is_active', 'full_name'] as const;
        type AllowedField = (typeof ALLOWED_FIELDS)[number];

        const sanitized: Partial<Record<AllowedField, any>> = {};
        for (const key of ALLOWED_FIELDS) {
            if (key in updates) {
                sanitized[key] = updates[key];
            }
        }

        if (Object.keys(sanitized).length === 0) {
            return NextResponse.json({ error: 'No se enviaron campos válidos para actualizar' }, { status: 400 });
        }

        // Validate role value if present
        const VALID_ROLES = ['admin', 'logistics', 'sales', 'billing', 'operator'];
        if (sanitized.role && !VALID_ROLES.includes(sanitized.role)) {
            return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
        }

        // Sanitize full_name if present
        if (sanitized.full_name !== undefined) {
            if (typeof sanitized.full_name !== 'string' || sanitized.full_name.trim().length < 2) {
                return NextResponse.json({ error: 'Nombre inválido (mín. 2 caracteres)' }, { status: 400 });
            }
            sanitized.full_name = sanitizeLine(sanitized.full_name, 100);
        }

        // Validate is_active if present
        if ('is_active' in sanitized && typeof sanitized.is_active !== 'boolean') {
            return NextResponse.json({ error: 'is_active debe ser true/false' }, { status: 400 });
        }

        // SUPER ADMIN PROTECTION — env var with fallback
        const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'ivaneyroa@shippar.net';

        const { data: targetProfile } = await supabaseAdmin
            .from('profiles')
            .select('email, role')
            .eq('id', userId)
            .single();

        // Nobody can modify the super admin
        if (targetProfile?.email === SUPER_ADMIN_EMAIL) {
            return NextResponse.json({ error: 'El super administrador no puede ser modificado' }, { status: 403 });
        }

        // Admins cannot change their OWN role (prevents locking yourself out)
        if (userId === requestingUser.id && sanitized.role) {
            return NextResponse.json({ error: 'No podés cambiar tu propio rol' }, { status: 403 });
        }

        // Admins cannot deactivate themselves
        if (userId === requestingUser.id && sanitized.is_active === false) {
            return NextResponse.json({ error: 'No podés desactivarte a vos mismo' }, { status: 403 });
        }

        // Update profile — only whitelisted fields
        const { error } = await supabaseAdmin
            .from('profiles')
            .update(sanitized)
            .eq('id', userId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // If deactivating, also disable auth user
        if (sanitized.is_active === false) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
                ban_duration: '876600h' // ~100 years = basically permanent
            });
        } else if (sanitized.is_active === true) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
                ban_duration: 'none'
            });
        }

        // Audit: user modification
        await logAudit({
            actorId: requestingUser.id,
            actorEmail: requestingUser.email || '',
            action: sanitized.role ? 'update_user_role' : sanitized.is_active !== undefined ? 'toggle_user_active' : 'update_user',
            targetTable: 'profiles',
            targetId: userId,
            oldValues: { role: targetProfile?.role },
            newValues: sanitized,
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
