-- ==========================================
-- SHIPPAR: ANTI-FRAUDE & VERIFICACIÓN DE PAGO
-- ==========================================

-- 1. Agregar columnas para comprobante y notas de pago
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- 2. Comentario para documentación
COMMENT ON COLUMN public.shipments.payment_proof_url IS 'URL de la imagen del comprobante de pago subido a Supabase Storage';
COMMENT ON COLUMN public.shipments.payment_notes IS 'Notas justificativas para pagos parciales o discrepancias';
