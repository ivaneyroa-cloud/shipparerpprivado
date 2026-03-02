import { supabase } from '@/lib/supabase';

/**
 * Fire-and-forget performance tracking after a reception is completed.
 * Errors are caught and logged but never break the main flow.
 */
export async function trackReceptionPerformance({
    shipmentId,
    trackingNumber,
    totalComputable,
    boxesCount,
    deltaKg,
    hadErrors,
    isEdit,
    durationSec,
    receptionStatus,
}: {
    shipmentId: string;
    trackingNumber: string;
    totalComputable: number;
    boxesCount: number;
    deltaKg: number;
    hadErrors: boolean;
    isEdit: boolean;
    durationSec: number;
    receptionStatus: string;
}) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        const userId = session.user.id;

        // Log the main event
        await supabase.from('performance_events').insert({
            user_id: userId,
            event_type: isEdit ? 'post_edit_detected' : 'reception_confirmed',
            shipment_id: shipmentId,
            metadata: {
                tracking_number: trackingNumber,
                kg_managed: totalComputable,
                boxes_count: boxesCount,
                delta_kg: deltaKg,
                had_errors: hadErrors,
                is_edit: isEdit,
                duration_seconds: durationSec,
                reception_status: receptionStatus,
            },
        }).then(() => { });

        // Log difference detection separately
        if (Math.abs(deltaKg) > 0.5 && !isEdit) {
            await supabase.from('performance_events').insert({
                user_id: userId,
                event_type: 'difference_detected',
                shipment_id: shipmentId,
                metadata: { delta_kg: deltaKg, tracking_number: trackingNumber },
            }).then(() => { });
        }

        // Update daily stats (upsert)
        const today = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase
            .from('user_daily_stats')
            .select('*')
            .eq('user_id', userId)
            .eq('stat_date', today)
            .maybeSingle();

        if (existing) {
            await supabase.from('user_daily_stats').update({
                receptions_count: (existing.receptions_count || 0) + 1,
                kg_managed: parseFloat(((existing.kg_managed || 0) + totalComputable).toFixed(2)),
                differences_detected: (existing.differences_detected || 0) + (Math.abs(deltaKg) > 0.5 ? 1 : 0),
                clean_receptions: (existing.clean_receptions || 0) + (!hadErrors ? 1 : 0),
                total_receptions: (existing.total_receptions || 0) + 1,
                avg_reception_seconds: Math.round(
                    ((existing.avg_reception_seconds || 0) * (existing.total_receptions || 0) + durationSec) / ((existing.total_receptions || 0) + 1)
                ),
                updated_at: new Date().toISOString(),
            }).eq('id', existing.id);
        } else {
            await supabase.from('user_daily_stats').insert({
                user_id: userId,
                stat_date: today,
                receptions_count: 1,
                kg_managed: totalComputable,
                differences_detected: Math.abs(deltaKg) > 0.5 ? 1 : 0,
                clean_receptions: !hadErrors ? 1 : 0,
                total_receptions: 1,
                avg_reception_seconds: durationSec,
            });
        }
    } catch (perfErr) {
        // Never break reception flow for performance tracking
        console.warn('[Performance] Tracking failed:', perfErr);
    }
}
