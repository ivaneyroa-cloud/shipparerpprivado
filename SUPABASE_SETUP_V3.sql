-- ============================================================
-- SUPABASE MIGRATION V3: 
-- Sistema de Roles, Vendedores, Cotizaciones y Activity Tracking
-- ============================================================

-- ===========================================
-- 1. Actualizar tabla PROFILES con roles expandidos
-- ===========================================
-- Roles: 'admin', 'logistics', 'sales', 'billing', 'operator'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;

-- Actualizar el perfil existente a 'admin' (el tuyo)
-- Ejecutar después de correr esta migración:
-- UPDATE profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'TU_EMAIL_AQUI');

-- ===========================================
-- 2. Asignación de Clientes a Vendedores
-- ===========================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id);

-- ===========================================
-- 3. Cotización obligatoria en Envíos
-- ===========================================
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS quote_url TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS quote_amount NUMERIC;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS quote_currency TEXT DEFAULT 'USD';

-- ===========================================
-- 4. Tabla de Facturación / Cobranzas
-- ===========================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id),
    amount NUMERIC NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending', -- pending, invoiced, paid, overdue
    invoice_number TEXT,
    payment_method TEXT,
    payment_date DATE,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users invoices access" ON invoices FOR ALL USING (auth.role() = 'authenticated');

-- ===========================================
-- 5. Activity tracking (Heartbeats)
-- ===========================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    active_seconds INTEGER DEFAULT 0,
    page_views JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users activity access" ON activity_logs FOR ALL USING (auth.role() = 'authenticated');

-- ===========================================
-- 6. Chat / Mensajes internos
-- ===========================================
CREATE TABLE IF NOT EXISTS chat_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'group', -- 'group', 'direct', 'bot'
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- 'text', 'bot_response', 'system'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users chat_channels access" ON chat_channels FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users chat_messages access" ON chat_messages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users chat_members access" ON chat_members FOR ALL USING (auth.role() = 'authenticated');

-- ===========================================
-- 7. Trigger para crear perfil al registrar usuario
-- ===========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'operator')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- 8. Política para que admins puedan gestionar perfiles
-- ===========================================
DROP POLICY IF EXISTS "Profiles are viewable by auth users" ON profiles;
CREATE POLICY "Auth users can view profiles" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can update profiles" ON profiles FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ===========================================
-- 9. Storage bucket para cotizaciones
-- ===========================================
-- Ejecutar esto manualmente en Supabase Dashboard > Storage:
-- 1. Crear bucket llamado "shipment-quotes" (público o con políticas)
-- 2. O ejecutar:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('shipment-quotes', 'shipment-quotes', true);

-- Política de acceso al bucket:
-- CREATE POLICY "Auth users can upload quotes" ON storage.objects
--     FOR INSERT WITH CHECK (bucket_id = 'shipment-quotes' AND auth.role() = 'authenticated');
-- CREATE POLICY "Auth users can view quotes" ON storage.objects
--     FOR SELECT USING (bucket_id = 'shipment-quotes' AND auth.role() = 'authenticated');
-- CREATE POLICY "Public can view quotes" ON storage.objects
--     FOR SELECT USING (bucket_id = 'shipment-quotes');

-- ===========================================
-- 10. Trigger updated_at para invoices
-- ===========================================
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
