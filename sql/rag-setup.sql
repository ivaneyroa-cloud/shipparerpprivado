-- ═══════════════════════════════════════════════════════════════
-- SHIPPAR AUDITOR CHAT — RAG + LOGGING TABLES
-- Requires pgvector extension enabled in Supabase
-- ═══════════════════════════════════════════════════════════════

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ──────────────────────────────────────────────
-- 1. KNOWLEDGE DOCUMENTS (uploaded SOPs, tarifarios, etc.)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    doc_type text NOT NULL,  -- 'sop' | 'tarifario' | 'politica' | 'plantilla'
    file_url text,
    version integer DEFAULT 1,
    chunks_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "authenticated_read_docs" ON knowledge_documents
        FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "admin_manage_docs" ON knowledge_documents
        FOR ALL USING (
            EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────
-- 2. KNOWLEDGE CHUNKS (vectorized chunks for RAG)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    document_title text NOT NULL,
    document_type text NOT NULL,
    section_title text,
    chunk_text text NOT NULL,
    chunk_index integer NOT NULL,
    embedding vector(1536),      -- OpenAI text-embedding-3-small dimensions
    metadata jsonb DEFAULT '{}',
    route text,                  -- 'china' | 'usa' | 'europa' | null
    topic text,                  -- 'cotizacion' | 'invoice' | 'recepcion' | etc
    version integer DEFAULT 1,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "authenticated_read_chunks" ON knowledge_chunks
        FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "admin_manage_chunks" ON knowledge_chunks
        FOR ALL USING (
            EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.72,
    match_count int DEFAULT 5,
    filter_route text DEFAULT NULL,
    filter_topic text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    document_title text,
    section_title text,
    chunk_text text,
    document_type text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.document_title,
        kc.section_title,
        kc.chunk_text,
        kc.document_type,
        1 - (kc.embedding <=> query_embedding) AS similarity
    FROM knowledge_chunks kc
    WHERE
        1 - (kc.embedding <=> query_embedding) > match_threshold
        AND (filter_route IS NULL OR kc.route = filter_route OR kc.route IS NULL)
        AND (filter_topic IS NULL OR kc.topic = filter_topic OR kc.topic IS NULL)
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Index for fast vector search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON knowledge_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_route ON knowledge_chunks(route);
CREATE INDEX IF NOT EXISTS idx_chunks_topic ON knowledge_chunks(topic);

-- ──────────────────────────────────────────────
-- 3. CHAT CONVERSATIONS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_conversations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid NOT NULL,
    title text,
    message_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "users_own_conversations" ON chat_conversations
        FOR ALL USING (auth.uid() = employee_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "admin_read_conversations" ON chat_conversations
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────
-- 4. CHAT AUDIT LOGS (per-message logging)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL,
    raw_message text NOT NULL,
    parsed_json jsonb,
    computed_json jsonb,
    alerts_json jsonb,
    assistant_answer text,
    sources_used jsonb,         -- [{doc_id, title, section}]
    employee_action text DEFAULT 'pending',  -- 'corrected' | 'ignored' | 'escalated' | 'pending'
    ignore_reason text,
    response_time_ms integer,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "users_insert_own_logs" ON chat_audit_logs
        FOR INSERT WITH CHECK (auth.uid() = employee_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "users_read_own_logs" ON chat_audit_logs
        FOR SELECT USING (auth.uid() = employee_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "users_update_own_logs" ON chat_audit_logs
        FOR UPDATE USING (auth.uid() = employee_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "admin_read_all_logs" ON chat_audit_logs
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_logs_employee ON chat_audit_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_conversation ON chat_audit_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_action ON chat_audit_logs(employee_action);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created ON chat_audit_logs(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- DONE! RAG tables + chat logging ready.
-- Next: upload documents through the admin panel to start indexing.
-- ═══════════════════════════════════════════════════════════════
