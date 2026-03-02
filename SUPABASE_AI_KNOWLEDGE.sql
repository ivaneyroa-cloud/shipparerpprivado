-- ==========================================
-- SHIPPAR: TABLA DE CONOCIMIENTO DINÁMICO (AI MEMORY)
-- ==========================================
-- Los empleados pueden guardar respuestas útiles del chat
-- y el bot las recuerda en futuras conversaciones.

CREATE TABLE IF NOT EXISTS public.ai_knowledge (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    created_by UUID REFERENCES auth.users(id),
    created_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Todos los usuarios autenticados pueden leer
ALTER TABLE public.ai_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ai_knowledge"
ON public.ai_knowledge FOR SELECT
TO authenticated
USING (true);

-- Todos los usuarios autenticados pueden agregar
CREATE POLICY "Authenticated users can insert ai_knowledge"
ON public.ai_knowledge FOR INSERT
TO authenticated
WITH CHECK (true);

-- Solo admin puede borrar
CREATE POLICY "Only admins can delete ai_knowledge"
ON public.ai_knowledge FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);
