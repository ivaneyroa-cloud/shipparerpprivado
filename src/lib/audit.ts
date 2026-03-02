import { supabaseAdmin } from './supabase-admin';

interface AuditParams {
    actorId: string;
    actorEmail: string;
    action: string;
    targetTable?: string;
    targetId?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
}

/**
 * Log an action to the audit_log table (server-side only).
 *
 * This uses the service role client so it bypasses RLS —
 * the audit_log table should NOT have INSERT policies for
 * anon/authenticated, only SELECT for admins.
 *
 * Fire-and-forget: we don't want audit failures to break
 * business logic, so errors are logged but not thrown.
 */
export async function logAudit(params: AuditParams): Promise<void> {
    try {
        const { error } = await supabaseAdmin.from('audit_log').insert({
            actor_id: params.actorId,
            actor_email: params.actorEmail,
            action: params.action,
            target_table: params.targetTable || null,
            target_id: params.targetId || null,
            old_values: params.oldValues || null,
            new_values: params.newValues || null,
        });

        if (error) {
            // Log but don't throw — audit failure must not break business flow
            console.error('[audit] Failed to write audit log:', error.message);
        }
    } catch (err) {
        console.error('[audit] Unexpected error writing audit log:', err);
    }
}
