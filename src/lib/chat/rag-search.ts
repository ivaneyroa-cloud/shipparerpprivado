/**
 * RAG Search — Retrieves relevant knowledge chunks using pgvector.
 * Uses OpenAI embeddings + Supabase vector similarity search.
 */

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface RAGChunk {
    id: string;
    document_title: string;
    section_title: string | null;
    chunk_text: string;
    document_type: string;
    similarity: number;
}

/**
 * Generate embedding for a query string using OpenAI.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    });
    return response.data[0].embedding;
}

/**
 * Search knowledge base for relevant chunks.
 * Filters by detected route/topic for more precise results.
 */
export async function searchKnowledge(
    supabaseAdmin: any,
    query: string,
    options?: {
        route?: string | null;
        topic?: string | null;
        matchCount?: number;
        threshold?: number;
    }
): Promise<RAGChunk[]> {
    try {
        const embedding = await generateEmbedding(query);

        const { data, error } = await supabaseAdmin.rpc('match_knowledge_chunks', {
            query_embedding: embedding,
            match_threshold: options?.threshold ?? 0.72,
            match_count: options?.matchCount ?? 5,
            filter_route: options?.route ?? null,
            filter_topic: options?.topic ?? null,
        });

        if (error) {
            console.error('[RAG] Search error:', error);
            return [];
        }

        return (data || []) as RAGChunk[];
    } catch (err) {
        console.error('[RAG] Unexpected error:', err);
        return [];
    }
}

/**
 * Detect topic from parsed message for RAG filtering.
 */
export function detectTopic(text: string): string | null {
    const lower = text.toLowerCase();

    if (/cotiz|precio|tarifa|cuanto|cuesta|vale/.test(lower)) return 'cotizacion';
    if (/invoice|factura|commercial/.test(lower)) return 'invoice';
    if (/recep|recib|lleg|deposito|depósito/.test(lower)) return 'recepcion';
    if (/aduana|dga|despacho|import/.test(lower)) return 'aduana';
    if (/reclam|queja|demora|perdid/.test(lower)) return 'reclamos';
    if (/prohib|restri|no se puede/.test(lower)) return 'restricciones';

    return null;
}

/**
 * Format RAG chunks for the LLM context.
 */
export function formatRAGContext(chunks: RAGChunk[]): string {
    if (chunks.length === 0) {
        return 'No se encontró documentación interna relevante. Recomendá escalar a un supervisor.';
    }

    return chunks.map((c, i) =>
        `[${i + 1}] ${c.document_title}${c.section_title ? ` — ${c.section_title}` : ''}\n${c.chunk_text}`
    ).join('\n\n');
}
