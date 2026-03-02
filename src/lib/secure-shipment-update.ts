import { supabase } from '@/lib/supabase';

/**
 * Secure shipment field update — routes through the server-side API
 * which enforces:
 *   - Per-role field whitelist
 *   - State machine validation for internal_status
 *   - Numeric input validation
 *   - Audit logging
 *
 * @returns { success: boolean; error?: string; rejected?: string[] }
 */
export async function secureShipmentUpdate(
    shipmentId: string,
    fields: Record<string, any>
): Promise<{ success: boolean; error?: string; rejected?: string[] }> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            return { success: false, error: 'No autenticado' };
        }

        const res = await fetch('/api/shipments', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ shipmentId, fields }),
        });

        const data = await res.json();

        if (!res.ok) {
            return { success: false, error: data.error || 'Error desconocido', rejected: data.rejected };
        }

        return { success: true, rejected: data.rejected };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error de red' };
    }
}
