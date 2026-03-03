import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook to subscribe to Supabase Realtime changes on a table
 * and trigger a refetch callback when data changes.
 *
 * Usage:
 *   useRealtimeRefresh('shipments', fetchShipments);
 *   useRealtimeRefresh(['shipments', 'clients'], fetchAll);
 */
export function useRealtimeRefresh(
    tables: string | string[],
    onRefresh: () => void,
    enabled: boolean = true
) {
    const callbackRef = useRef(onRefresh);
    callbackRef.current = onRefresh;

    useEffect(() => {
        if (!enabled) return;

        const tableList = Array.isArray(tables) ? tables : [tables];
        const channelName = `realtime-${tableList.join('-')}-${Date.now()}`;

        let channel: RealtimeChannel = supabase.channel(channelName);

        for (const table of tableList) {
            channel = channel.on(
                'postgres_changes',
                { event: '*', schema: 'public', table },
                () => {
                    callbackRef.current();
                }
            );
        }

        channel.subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tables, enabled]);
}
