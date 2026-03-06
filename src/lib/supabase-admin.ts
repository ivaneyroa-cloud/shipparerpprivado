import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Lazy-initialized admin client — avoids crashing during Next.js
 * static page collection when env vars aren't available yet.
 * ONLY for server-side operations; NEVER expose to the browser.
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        if (!_client) {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (!url || !key) {
                throw new Error('Missing SUPABASE env vars (only available at runtime)');
            }
            _client = createClient(url, key, {
                auth: { autoRefreshToken: false, persistSession: false },
            });
        }
        return (_client as any)[prop];
    },
});
