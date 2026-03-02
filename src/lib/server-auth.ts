import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export interface AuthContext {
    userId: string;
    email: string;
    profile: {
        id: string;
        role: string;
        org_id: string | null;
        is_active: boolean;
        full_name: string | null;
    };
    token: string;
}

/**
 * Validates the Authorization header, extracts the user from the JWT,
 * and fetches their profile (role, org_id, is_active).
 *
 * Returns null if:
 *  - No Authorization header or bad format
 *  - Token is invalid / expired
 *  - User has no profile
 *  - User is not active
 */
export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);

    // Validate JWT via supabaseAdmin — no anon key needed server-side
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return null;

    // Fetch profile with role and org isolation data
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, role, org_id, is_active, full_name')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) return null;
    if (!profile.is_active) return null;

    return {
        userId: user.id,
        email: user.email || '',
        profile,
        token,
    };
}

/** Convenience: return a 401 JSON response */
export function unauthorized(message = 'No autorizado') {
    return NextResponse.json({ error: message }, { status: 401 });
}

/** Convenience: return a 403 JSON response */
export function forbidden(message = 'No tenés permiso para esta acción') {
    return NextResponse.json({ error: message }, { status: 403 });
}
