-- 1. Tipos de datos (Enums)
DO $$ BEGIN
    CREATE TYPE shipment_status AS ENUM (
        'Guía Creada', 
        'Pendiente Expo', 
        'En Transito', 
        'Recibido en Oficina',
        'Recibido',
        'Retirado',
        'Despachado',
        'Retenido',
        'Mercado Libre full'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tabla de Perfiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    role TEXT DEFAULT 'operator',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Envíos
CREATE TABLE IF NOT EXISTS shipments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tracking_number TEXT UNIQUE NOT NULL,
    client_name TEXT NOT NULL,
    client_code TEXT NOT NULL,
    category TEXT DEFAULT 'OTROS',
    weight NUMERIC DEFAULT 0,
    internal_status shipment_status DEFAULT 'Guía Creada',
    origin TEXT DEFAULT 'Miami',
    date_shipped DATE,
    date_arrived DATE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de Clientes
CREATE TABLE IF NOT EXISTS clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Logs de Auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES profiles(id),
    old_status TEXT,
    new_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Políticas de Seguridad (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública de envíos por tracking (para el buscador)
CREATE POLICY "Public tracking search" ON shipments FOR SELECT USING (true);

-- Permitir todo a usuarios autenticados (Panel Admin)
CREATE POLICY "Authenticated users full access" ON shipments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users clients access" ON clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Profiles are viewable by auth users" ON profiles FOR SELECT USING (auth.role() = 'authenticated');

-- 7. Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
