-- ============================================================
-- SHIPPAR: BILLING & WAREHOUSE WORKFLOW SETUP
-- ============================================================

-- 1. Campos de Cotización (Ventas)
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS precio_envio NUMERIC DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS gastos_documentales NUMERIC DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS impuestos NUMERIC DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS observaciones_cotizacion TEXT;

-- 2. Campos de Depósito / Recepción Operativa
-- NOTA: bultos guardará un array JSON con la estructura: 
-- [{'largo': cm, 'ancho': cm, 'alto': cm, 'peso_fisico': kg, 'peso_volumetrico': kg, 'peso_computable': kg}, ...]
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS bultos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS peso_computable NUMERIC DEFAULT 0;

-- 3. Campos de Cobranzas / Facturación
-- Opciones: 'Pendiente', 'Facturado', 'Pagado'
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS estado_cobranza TEXT DEFAULT 'Pendiente';

-- Update existing records to have empty array for JSONB to avoid null issues
UPDATE public.shipments SET bultos = '[]'::jsonb WHERE bultos IS NULL;

-- ============================================================
-- INSTRUCCIONES:
-- Ejecutar en el SQL Editor de Supabase para habilitar 
-- el nuevo workflow de Cotización -> Recepción -> Cobranza
-- ============================================================
