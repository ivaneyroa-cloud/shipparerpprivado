import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';


export async function GET(req: NextRequest) {
    try {
        // Verify auth
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (authErr || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Check admin/logistics role
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !['admin', 'logistics'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch post-delivery edits from last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: edits, error } = await supabaseAdmin
            .from('activity_logs')
            .select('id, user_id, action, details, created_at')
            .eq('action', 'reception_edit_post_delivery')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        // Enrich with user names
        const userIds = [...new Set((edits || []).map(e => e.user_id).filter(Boolean))];
        const { data: profiles } = userIds.length > 0
            ? await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', userIds)
            : { data: [] };

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        const enriched = (edits || []).map(log => {
            const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
            const profile = profileMap.get(log.user_id);
            return {
                id: log.id,
                shipment_id: details.shipment_id,
                tracking_number: details.tracking_number,
                edited_by: profile?.full_name || profile?.email || log.user_id,
                timestamp: log.created_at,
                reason: details.reason,
                version: details.version,
                delta_kg: details.delta_kg,
                delta_monto: details.delta_monto,
                diff: details.diff,
                severity: details.severity,
            };
        });

        return NextResponse.json({ data: enriched, count: enriched.length });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
