import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContext, unauthorized, forbidden } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Explicit column whitelist — only what the tools actually need
const SHIPMENT_COLUMNS = [
    'tracking_number', 'client_name', 'client_code', 'origin',
    'category', 'weight', 'peso_computable',
    'precio_envio', 'gastos_documentales', 'impuestos', 'costo_flete',
    'internal_status', 'date_shipped', 'date_arrived', 'retenido_nota',
    'created_at', 'org_id'
].join(', ');

// ── Tool definitions ──────────────────────────────────────────────────────────
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'get_top_clients',
            description: 'Returns clients ranked by a chosen metric (shipments count, total kg, revenue, or margin). Use for questions like "top clientes", "quién envía más", "clientes más rentables".',
            parameters: {
                type: 'object',
                properties: {
                    sort_by: { type: 'string', enum: ['count', 'kg', 'revenue', 'margin'], description: 'Metric to rank clients by' },
                    limit: { type: 'number', description: 'Max number of clients to return (default 10)' },
                },
                required: ['sort_by'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_shipments_summary',
            description: 'Returns general shipment stats: total count, total kg, revenue estimate, cost, margin. Use for general overview questions.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_category_analysis',
            description: 'Returns shipment distribution and revenue by product category. Use for questions about categories, products, or types of cargo.',
            parameters: {
                type: 'object',
                properties: {
                    sort_by: { type: 'string', enum: ['count', 'kg', 'revenue'], description: 'Metric to sort categories by' },
                },
                required: ['sort_by'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_transit_time_analysis',
            description: 'Returns average transit days (date_shipped to date_arrived) grouped by origin country. Use for questions about delivery times, delays, or transit performance.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_retention_analysis',
            description: 'Returns retained (retenido) shipments grouped by category and reason. Use for questions about retentions, detentions, or customs holds.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_anomalies',
            description: 'Detects data quality issues and operational anomalies: shipments missing category, missing weight, very long transit times, negative margins. Use for audit or quality questions.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_origin_distribution',
            description: 'Returns shipment count and kg by origin country/city. Use for questions about where shipments come from, routes, or origin analysis.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_clients_without_shipments',
            description: 'Returns clients who have not sent shipments in the given period. Useful for churn or inactivity analysis.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
];

// ── Tool executors ────────────────────────────────────────────────────────────
async function executeTools(name: string, args: any, shipments: any[], allClients: any[]): Promise<any> {
    switch (name) {
        case 'get_top_clients': {
            const { sort_by = 'count', limit = 10 } = args;
            const map: Record<string, { name: string; code: string; count: number; kg: number; revenue: number; cost: number }> = {};
            shipments.forEach(s => {
                const key = s.client_name || 'Sin nombre';
                if (!map[key]) map[key] = { name: key, code: s.client_code || '', count: 0, kg: 0, revenue: 0, cost: 0 };
                map[key].count++;
                map[key].kg += Number(s.peso_computable || s.weight || 0);
                map[key].revenue += Number(s.precio_envio || 0) + Number(s.gastos_documentales || 0) + Number(s.impuestos || 0);
                map[key].cost += Number(s.costo_flete || 0);
            });
            const sorted = Object.values(map)
                .map(c => ({ ...c, margin: c.revenue > 0 ? ((c.revenue - c.cost) / c.revenue * 100) : 0 }))
                .sort((a, b) => {
                    if (sort_by === 'kg') return b.kg - a.kg;
                    if (sort_by === 'revenue') return b.revenue - a.revenue;
                    if (sort_by === 'margin') return b.margin - a.margin;
                    return b.count - a.count;
                })
                .slice(0, limit);
            return { ranked_by: sort_by, total_clients: Object.keys(map).length, top_clients: sorted };
        }

        case 'get_shipments_summary': {
            const total = shipments.length;
            const kg = shipments.reduce((a, s) => a + Number(s.peso_computable || s.weight || 0), 0);
            const revenue = shipments.reduce((a, s) => a + Number(s.precio_envio || 0) + Number(s.gastos_documentales || 0) + Number(s.impuestos || 0), 0);
            const cost = shipments.reduce((a, s) => a + Number(s.costo_flete || 0), 0);
            const margin = revenue - cost;
            const byStatus: Record<string, number> = {};
            shipments.forEach(s => { byStatus[s.internal_status || 'N/D'] = (byStatus[s.internal_status || 'N/D'] || 0) + 1; });
            return { total_shipments: total, total_kg: Math.round(kg * 10) / 10, revenue_estimate: Math.round(revenue), total_cost: Math.round(cost), gross_margin: Math.round(margin), margin_pct: revenue > 0 ? Math.round(margin / revenue * 1000) / 10 : 0, by_status: byStatus };
        }

        case 'get_category_analysis': {
            const { sort_by = 'count' } = args;
            const map: Record<string, { count: number; kg: number; revenue: number }> = {};
            shipments.forEach(s => {
                const cat = s.category || 'SIN CATEGORÍA';
                if (!map[cat]) map[cat] = { count: 0, kg: 0, revenue: 0 };
                map[cat].count++;
                map[cat].kg += Number(s.peso_computable || s.weight || 0);
                map[cat].revenue += Number(s.precio_envio || 0) + Number(s.gastos_documentales || 0) + Number(s.impuestos || 0);
            });
            const sorted = Object.entries(map)
                .map(([cat, v]) => ({ category: cat, ...v, kg: Math.round(v.kg * 10) / 10 }))
                .sort((a, b) => sort_by === 'kg' ? b.kg - a.kg : sort_by === 'revenue' ? b.revenue - a.revenue : b.count - a.count);
            return { sorted_by: sort_by, categories: sorted };
        }

        case 'get_transit_time_analysis': {
            const withTransit = shipments.filter(s => s.date_shipped && s.date_arrived);
            const byOrigin: Record<string, { total_days: number; count: number; min: number; max: number }> = {};
            withTransit.forEach(s => {
                const origin = s.origin || 'N/D';
                const days = (new Date(s.date_arrived).getTime() - new Date(s.date_shipped).getTime()) / 86400000;
                if (days < 0) return;
                if (!byOrigin[origin]) byOrigin[origin] = { total_days: 0, count: 0, min: Infinity, max: 0 };
                byOrigin[origin].total_days += days;
                byOrigin[origin].count++;
                byOrigin[origin].min = Math.min(byOrigin[origin].min, days);
                byOrigin[origin].max = Math.max(byOrigin[origin].max, days);
            });
            const results = Object.entries(byOrigin).map(([origin, v]) => ({
                origin, shipments_measured: v.count,
                avg_days: Math.round(v.total_days / v.count * 10) / 10,
                min_days: Math.round(v.min), max_days: Math.round(v.max),
            })).sort((a, b) => b.shipments_measured - a.shipments_measured);
            return { total_measured: withTransit.length, not_measured: shipments.length - withTransit.length, by_origin: results };
        }

        case 'get_retention_analysis': {
            const retenidos = shipments.filter(s => s.internal_status === 'Retenido');
            const byCat: Record<string, number> = {};
            retenidos.forEach(s => { byCat[s.category || 'SIN CAT'] = (byCat[s.category || 'SIN CAT'] || 0) + 1; });
            const byClient: Record<string, number> = {};
            retenidos.forEach(s => { byClient[s.client_name || 'N/D'] = (byClient[s.client_name || 'N/D'] || 0) + 1; });
            return {
                total_retained: retenidos.length,
                retention_rate_pct: shipments.length > 0 ? Math.round(retenidos.length / shipments.length * 1000) / 10 : 0,
                by_category: Object.entries(byCat).sort(([, a], [, b]) => b - a).map(([cat, n]) => ({ category: cat, count: n })),
                by_client: Object.entries(byClient).sort(([, a], [, b]) => b - a).slice(0, 5).map(([client, n]) => ({ client, count: n })),
                sample_notes: retenidos.slice(0, 5).map(s => ({ tracking: s.tracking_number, client: s.client_name, note: s.retenido_nota || 'Sin nota' })),
            };
        }

        case 'get_anomalies': {
            const noCategory = shipments.filter(s => !s.category || s.category.trim() === '');
            const noWeight = shipments.filter(s => !s.weight || Number(s.weight) === 0);
            const longTransit = shipments.filter(s => {
                if (!s.date_shipped || !s.date_arrived) return false;
                const d = (new Date(s.date_arrived).getTime() - new Date(s.date_shipped).getTime()) / 86400000;
                return d > 60;
            });
            const negMargin = (() => {
                const map: Record<string, { revenue: number; cost: number }> = {};
                shipments.forEach(s => {
                    const k = s.client_name || 'N/D';
                    if (!map[k]) map[k] = { revenue: 0, cost: 0 };
                    map[k].revenue += Number(s.precio_envio || 0) + Number(s.gastos_documentales || 0) + Number(s.impuestos || 0);
                    map[k].cost += Number(s.costo_flete || 0);
                });
                return Object.entries(map).filter(([, v]) => v.revenue > 0 && v.revenue < v.cost).map(([name, v]) => ({ client: name, margin: Math.round(v.revenue - v.cost) }));
            })();
            return {
                missing_category: { count: noCategory.length, sample: noCategory.slice(0, 3).map(s => s.tracking_number) },
                missing_weight: { count: noWeight.length, sample: noWeight.slice(0, 3).map(s => s.tracking_number) },
                long_transit_over_60_days: { count: longTransit.length, sample: longTransit.slice(0, 3).map(s => ({ tracking: s.tracking_number, origin: s.origin })) },
                clients_negative_margin: negMargin.slice(0, 5),
            };
        }

        case 'get_origin_distribution': {
            const map: Record<string, { count: number; kg: number }> = {};
            shipments.forEach(s => {
                const o = s.origin || 'N/D';
                if (!map[o]) map[o] = { count: 0, kg: 0 };
                map[o].count++;
                map[o].kg += Number(s.peso_computable || s.weight || 0);
            });
            return Object.entries(map)
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([origin, v]) => ({ origin, count: v.count, kg: Math.round(v.kg * 10) / 10, pct: Math.round(v.count / shipments.length * 1000) / 10 }));
        }

        case 'get_clients_without_shipments': {
            const activeClientNames = new Set(shipments.map(s => s.client_name).filter(Boolean));
            const inactive = allClients.filter(c => !activeClientNames.has(c.name));
            return { inactive_count: inactive.length, total_clients: allClients.length, sample: inactive.slice(0, 10).map(c => ({ name: c.name, code: c.code })) };
        }

        default:
            return { error: 'Unknown function' };
    }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        // ── Rate limit gate — 20 req/min for AI endpoints ──
        const rl = checkRateLimit(req, 20, 60_000);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Demasiadas solicitudes. Esperá un momento.' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
            );
        }

        // ── Auth gate ──
        const ctx = await getAuthContext(req);
        if (!ctx) return unauthorized();
        if (!['admin', 'logistics'].includes(ctx.profile.role)) {
            return forbidden('Solo admin y logistics pueden usar el chat ERP');
        }

        const { question, from, to, history = [] } = await req.json();
        const orgId = ctx.profile.org_id;

        // 1. Fetch data from Supabase — scoped to org + explicit columns
        const shipmentsQuery = supabaseAdmin
            .from('shipments')
            .select(SHIPMENT_COLUMNS)
            .gte('created_at', from)
            .lte('created_at', to + ' 23:59:59');
        if (orgId) shipmentsQuery.eq('org_id', orgId);

        const clientsQuery = supabaseAdmin
            .from('clients')
            .select('id, name, code');
        if (orgId) clientsQuery.eq('org_id', orgId);

        const [shipmentsRes, clientsRes] = await Promise.all([
            shipmentsQuery,
            clientsQuery,
        ]);
        const shipments = shipmentsRes.data || [];
        const allClients = clientsRes.data || [];

        const systemPrompt = `Sos un analista de datos experto de una empresa de logística de importaciones llamada Shippar. 
Respondés preguntas sobre envíos, clientes, categorías, márgenes y operaciones.
El período analizado es del ${from} al ${to}.
Actualmente hay ${shipments.length} envíos en ese período.
Siempre respondés en español argentino, de forma clara, directa y profesional.
Cuando mostrés números monetarios, usá el símbolo $ y puntos de miles.
Si hay anomalías o problemas, destacalos con emojis de alerta ⚠️.
Sé conciso pero completo. Usá bullet points cuando sea útil.`;

        // 2. First call — let model decide which tool to call
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-6), // last 3 exchanges for context
            { role: 'user', content: question },
        ];

        const firstResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            tools,
            tool_choice: 'auto',
            temperature: 0.2,
        });

        const firstChoice = firstResponse.choices[0].message;

        // 3. If no tool call, return direct answer with unverified disclaimer
        if (!firstChoice.tool_calls || firstChoice.tool_calls.length === 0) {
            return NextResponse.json({
                answer: firstChoice.content,
                table: null,
                unverified: true, // flag for UI: this response is not backed by tool data
            });
        }

        // 4. Execute the tool call(s)
        const toolCall = firstChoice.tool_calls[0] as OpenAI.Chat.Completions.ChatCompletionMessageToolCall & {
            function: { name: string; arguments: string };
        };
        const toolArgs = JSON.parse(toolCall.function.arguments);
        const toolResult = await executeTools(toolCall.function.name, toolArgs, shipments, allClients);

        // 5. Second call — model gets the data and formulates the answer
        const secondMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            ...messages,
            firstChoice,
            {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult),
            },
        ];

        const secondResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: secondMessages,
            temperature: 0.3,
        });

        const finalAnswer = secondResponse.choices[0].message.content || '';

        // 6. Extract structured table if applicable
        let table = null;
        if (toolCall.function.name === 'get_top_clients' && toolResult.top_clients) {
            table = {
                columns: ['#', 'Cliente', 'Código', 'Envíos', 'KG', 'Revenue', 'Margen %'],
                rows: toolResult.top_clients.map((c: any, i: number) => [
                    i + 1, c.name, c.code, c.count,
                    c.kg.toFixed(1),
                    `$${c.revenue.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`,
                    `${c.margin.toFixed(1)}%`,
                ]),
            };
        } else if (toolCall.function.name === 'get_category_analysis' && toolResult.categories) {
            table = {
                columns: ['Categoría', 'Envíos', 'KG', 'Revenue'],
                rows: toolResult.categories.slice(0, 15).map((c: any) => [
                    c.category, c.count, c.kg,
                    `$${c.revenue.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`,
                ]),
            };
        } else if (toolCall.function.name === 'get_transit_time_analysis' && toolResult.by_origin) {
            table = {
                columns: ['Origen', 'Envíos medidos', 'Prom. días', 'Mín.', 'Máx.'],
                rows: toolResult.by_origin.map((o: any) => [o.origin, o.shipments_measured, o.avg_days, o.min_days, o.max_days]),
            };
        } else if (toolCall.function.name === 'get_origin_distribution' && Array.isArray(toolResult)) {
            table = {
                columns: ['Origen', 'Envíos', 'KG', '%'],
                rows: toolResult.map((o: any) => [o.origin, o.count, o.kg, `${o.pct}%`]),
            };
        }

        return NextResponse.json({ answer: finalAnswer, table });

    } catch (err: any) {
        console.error('[erp-chat]', err);
        return NextResponse.json({ answer: `Error al procesar la consulta: ${err.message}`, table: null }, { status: 500 });
    }
}
