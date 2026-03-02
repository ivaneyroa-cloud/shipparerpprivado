-- 1. Asegurarnos que todos los campos anteriores y nuevos existan
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS precio_envio NUMERIC DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS gastos_documentales NUMERIC DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS impuestos NUMERIC DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS costo_flete NUMERIC DEFAULT 0; -- NUEVO: Costo de flete facturado
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS observaciones_cotizacion TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS bultos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS peso_computable NUMERIC DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS estado_cobranza TEXT DEFAULT 'Pendiente';
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS invoice_photo_1 TEXT; -- NUEVO: Foto factura 1
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS invoice_photo_2 TEXT; -- NUEVO: Foto factura 2

-- Evitar nulos en bultos
UPDATE public.shipments SET bultos = '[]'::jsonb WHERE bultos IS NULL;

-- 2. Crear el Bucket de Storage para las facturas si no existe
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de Storage para el bucket "invoices"
-- Permitir select a todos de este bucket
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'invoices');

-- Permitir insert a usuarios logueados
DROP POLICY IF EXISTS "Auth Insert" ON storage.objects;
CREATE POLICY "Auth Insert" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'invoices' AND auth.role() = 'authenticated');

-- 4. CRÍTICO: Recargar el caché del esquema para la API REST de Supabase
-- Esto evita el error "Could not find the 'bultos' column"
NOTIFY pgrst, 'reload schema';
