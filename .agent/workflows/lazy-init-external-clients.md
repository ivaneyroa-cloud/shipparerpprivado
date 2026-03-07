---
description: How to properly initialize external clients (Supabase, OpenAI, etc.) in Next.js to avoid Vercel build failures
---

# Lazy Initialization of External Clients in Next.js

## Problem
When deploying a Next.js app to Vercel, the build process runs a "Collecting page data" step that executes module-level code. If external clients (Supabase, OpenAI, etc.) are initialized at module scope using environment variables, the build **crashes** because those env vars are not available during build time — only at runtime.

**Common error messages:**
- `Error: supabaseUrl is required.`
- `Error: Missing credentials. Please pass an apiKey, or set the OPENAI_API_KEY environment variable.`
- `Failed to collect page data for /api/...`

## Rule: NEVER initialize external clients at module scope

### ❌ WRONG — Eager initialization (crashes during build):
```typescript
import { createClient } from '@supabase/supabase-js';

// This runs IMMEDIATELY when the file is imported — before env vars exist
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

```typescript
import OpenAI from 'openai';

// Same problem — crashes at build time
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

### ✅ CORRECT — Lazy initialization (safe for build):

**Option A: Proxy pattern (for shared singleton exports)**
```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

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
```

**Option B: Getter function (for clients used in specific files)**
```typescript
import OpenAI from 'openai';

let _openai: OpenAI | null = null;
function getOpenAI() {
    if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _openai;
}

// Usage: getOpenAI().chat.completions.create(...)
```

**Option C: Inside handler function (for inline clients in API routes)**
```typescript
// This is fine because it only runs when the API is called
export async function GET(req: NextRequest) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    // ...
}
```

## When to Apply
- **ALWAYS** when creating Supabase admin clients (`SUPABASE_SERVICE_ROLE_KEY`)
- **ALWAYS** when creating OpenAI / AI SDK clients
- **ALWAYS** when using any env var that is only available at runtime (not `NEXT_PUBLIC_*` in client components)
- **ANY** external service SDK that requires credentials at initialization

## Security Notes
- This does NOT change security. Same keys, same access, same RLS policies.
- The only difference is WHEN the client is created (on first use vs on import).
- Server-side keys (`SUPABASE_SERVICE_ROLE_KEY`) are still NEVER exposed to the browser.

## How to Verify
Run `npx next build` locally. If it passes with exit code 0, Vercel will also pass.
