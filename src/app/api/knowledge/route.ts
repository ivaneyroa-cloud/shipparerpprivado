import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContext, unauthorized } from '@/lib/server-auth';

// GET: Load all knowledge entries (for AI context) — requires authenticated user
export async function GET(req: NextRequest) {
    const ctx = await getAuthContext(req);
    if (!ctx) return unauthorized();

    try {
        const query = supabaseAdmin
            .from('ai_knowledge')
            .select('content, category, created_by_name, created_at')
            .order('created_at', { ascending: false })
            .limit(100);

        // Scope to org if available
        if (ctx.profile.org_id) {
            query.eq('org_id', ctx.profile.org_id);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error loading knowledge:', error);
            return NextResponse.json({ entries: [] });
        }

        return NextResponse.json({ entries: data || [] });
    } catch {
        return NextResponse.json({ entries: [] });
    }
}

// POST: Save a new knowledge entry — userId comes from JWT, NOT from body
export async function POST(req: NextRequest) {
    const ctx = await getAuthContext(req);
    if (!ctx) return unauthorized();

    try {
        const { content, category } = await req.json();

        if (!content) {
            return NextResponse.json({ error: 'Content required' }, { status: 400 });
        }

        // Sanitize content: strip potential prompt injection markers
        const sanitizedContent = content
            .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi, '[FILTERED]')
            .replace(/system\s*:/gi, '[FILTERED]')
            .trim();

        if (!sanitizedContent || sanitizedContent.length < 3) {
            return NextResponse.json({ error: 'Contenido inválido' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('ai_knowledge')
            .insert({
                content: sanitizedContent,
                category: category || 'general',
                created_by: ctx.userId,                          // from JWT, not body
                created_by_name: ctx.profile.full_name || ctx.email.split('@')[0] || 'Equipo',
                org_id: ctx.profile.org_id,                      // org isolation
            });

        if (error) {
            console.error('Error saving knowledge:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
